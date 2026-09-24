package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wsChild        = 0x40000000
	wsVisible      = 0x10000000
	wsClipSiblings = 0x04000000
	wsClipChildren = 0x02000000
	wsPopup        = 0x80000000
	wsExNoActivate = 0x08000000
	wsExToolWindow = 0x00000080
	wsExNoRedirect = 0x00200000

	wmDestroy   = 0x0002
	wmQuit      = 0x0012
	wmNcHitTest = 0x0084
	wmEraseBkg  = 0x0014
	htTransparent = 0xFFFFFFFF

	gwlStyle       = uintptr(0xFFFFFFF0) // -16
	gwlpHwndParent = uintptr(0xFFFFFFF8) // -8
	swpNoZOrder    = 0x0004
	swpNoActivate  = 0x0010
	swpShowWindow  = 0x0040
	swpFrameChanged = 0x0020
	hwndTop        = 0
	swShow         = 5
	pmRemove       = 0x0001
	csHRedraw      = 0x0002
	csVRedraw      = 0x0001
	blackBrush     = 4
)

type wndClassEx struct {
	cbSize        uint32
	style         uint32
	lpfnWndProc   uintptr
	cbClsExtra    int32
	cbWndExtra    int32
	hInstance     windows.Handle
	hIcon         windows.Handle
	hCursor       windows.Handle
	hbrBackground windows.Handle
	lpszMenuName  *uint16
	lpszClassName *uint16
	hIconSm       windows.Handle
}

type msg struct {
	hwnd    uintptr
	message uint32
	wParam  uintptr
	lParam  uintptr
	time    uint32
	pt      struct{ x, y int32 }
}

type trackDesc struct {
	Id   int32
	_    [4]byte
	Name uintptr
	Next uintptr
}

type command struct {
	Cmd      string  `json:"cmd"`
	URL      string  `json:"url"`
	X        int32   `json:"x"`
	Y        int32   `json:"y"`
	W        int32   `json:"w"`
	H        int32   `json:"h"`
	Ms       int64   `json:"ms"`
	Value    float64 `json:"value"`
	ID       int     `json:"id"`
	Muted    bool    `json:"muted"`
	StartMs  int64   `json:"startMs"`
}

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")
	shcore   = windows.NewLazySystemDLL("shcore.dll")

	procCreateWindowExW    = user32.NewProc("CreateWindowExW")
	procRegisterClassExW   = user32.NewProc("RegisterClassExW")
	procDefWindowProcW     = user32.NewProc("DefWindowProcW")
	procPeekMessageW       = user32.NewProc("PeekMessageW")
	procTranslateMessage   = user32.NewProc("TranslateMessage")
	procDispatchMessageW   = user32.NewProc("DispatchMessageW")
	procShowWindow         = user32.NewProc("ShowWindow")
	procUpdateWindow       = user32.NewProc("UpdateWindow")
	procSetParent          = user32.NewProc("SetParent")
	procMoveWindow         = user32.NewProc("MoveWindow")
	procSetWindowLongPtrW  = user32.NewProc("SetWindowLongPtrW")
	procGetWindowLongPtrW  = user32.NewProc("GetWindowLongPtrW")
	procSetWindowPos       = user32.NewProc("SetWindowPos")
	procDestroyWindow      = user32.NewProc("DestroyWindow")
	procGetModuleHandleW   = kernel32.NewProc("GetModuleHandleW")
	procPostQuitMessage    = user32.NewProc("PostQuitMessage")
	procGetStockObject     = gdi32.NewProc("GetStockObject")
	procInvalidateRect     = user32.NewProc("InvalidateRect")
	procMsgWait            = user32.NewProc("MsgWaitForMultipleObjects")
	procSleep              = kernel32.NewProc("Sleep")
	keepCStrings           []*byte

	wndProcCallback = syscall.NewCallback(wndProc)

	videoHWND   uintptr
	parentHWND  uintptr
	vlc         *vlcAPI
	instance    uintptr
	player      uintptr
	media       uintptr
	startedSeek bool
	startMs     int64
	prefsAudio  string
	prefsSubs   string
	prefsDone   bool
	userAudio   bool
	userSub     bool
	mu          sync.Mutex
)

func wndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	switch message {
	case wmNcHitTest:
		return htTransparent
	case wmEraseBkg:
		return 1
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

func emit(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Printf("AURA %s\n", b)
}

func cstr(p uintptr) string {
	if p == 0 {
		return ""
	}
	return windows.BytePtrToString((*byte)(unsafe.Pointer(p)))
}

type vlcAPI struct {
	dll                        *windows.DLL
	new_                       *windows.Proc
	release                    *windows.Proc
	mediaNewLocation           *windows.Proc
	mediaAddOption             *windows.Proc
	mediaRelease               *windows.Proc
	mediaPlayerNewFromMedia    *windows.Proc
	mediaPlayerRelease         *windows.Proc
	mediaPlayerSetHWND         *windows.Proc
	mediaPlayerPlay            *windows.Proc
	mediaPlayerPause           *windows.Proc
	mediaPlayerStop            *windows.Proc
	mediaPlayerIsPlaying       *windows.Proc
	mediaPlayerSetPause        *windows.Proc
	mediaPlayerGetTime         *windows.Proc
	mediaPlayerSetTime         *windows.Proc
	mediaPlayerGetLength       *windows.Proc
	mediaPlayerSetRate         *windows.Proc
	audioGetTrack              *windows.Proc
	audioSetTrack              *windows.Proc
	audioGetTrackDescription   *windows.Proc
	audioSetVolume             *windows.Proc
	audioGetVolume             *windows.Proc
	audioSetMute               *windows.Proc
	audioGetMute               *windows.Proc
	videoGetSpu                *windows.Proc
	videoSetSpu                *windows.Proc
	videoGetSpuDescription     *windows.Proc
	videoSetKeyInput           *windows.Proc
	videoSetMouseInput         *windows.Proc
	trackDescriptionListRelease *windows.Proc
}

func loadVLC(dir string) (*vlcAPI, error) {
	dllPath := filepath.Join(dir, "libvlc.dll")
	if _, err := os.Stat(dllPath); err != nil {
		return nil, fmt.Errorf("libvlc.dll não encontrado em %s", dir)
	}
	os.Setenv("VLC_PLUGIN_PATH", filepath.Join(dir, "plugins"))
	os.Setenv("PATH", dir+";"+os.Getenv("PATH"))

	h, err := windows.LoadDLL(dllPath)
	if err != nil {
		return nil, fmt.Errorf("LoadDLL libvlc: %w", err)
	}
	must := func(name string) *windows.Proc {
		p, e := h.FindProc(name)
		if e != nil {
			panic(e)
		}
		return p
	}
	return &vlcAPI{
		dll:                         h,
		new_:                        must("libvlc_new"),
		release:                     must("libvlc_release"),
		mediaNewLocation:            must("libvlc_media_new_location"),
		mediaAddOption:              must("libvlc_media_add_option"),
		mediaRelease:                must("libvlc_media_release"),
		mediaPlayerNewFromMedia:     must("libvlc_media_player_new_from_media"),
		mediaPlayerRelease:          must("libvlc_media_player_release"),
		mediaPlayerSetHWND:          must("libvlc_media_player_set_hwnd"),
		mediaPlayerPlay:             must("libvlc_media_player_play"),
		mediaPlayerPause:            must("libvlc_media_player_pause"),
		mediaPlayerStop:             must("libvlc_media_player_stop"),
		mediaPlayerIsPlaying:        must("libvlc_media_player_is_playing"),
		mediaPlayerSetPause:         must("libvlc_media_player_set_pause"),
		mediaPlayerGetTime:          must("libvlc_media_player_get_time"),
		mediaPlayerSetTime:          must("libvlc_media_player_set_time"),
		mediaPlayerGetLength:        must("libvlc_media_player_get_length"),
		mediaPlayerSetRate:          must("libvlc_media_player_set_rate"),
		audioGetTrack:               must("libvlc_audio_get_track"),
		audioSetTrack:               must("libvlc_audio_set_track"),
		audioGetTrackDescription:    must("libvlc_audio_get_track_description"),
		audioSetVolume:              must("libvlc_audio_set_volume"),
		audioGetVolume:              must("libvlc_audio_get_volume"),
		audioSetMute:                must("libvlc_audio_set_mute"),
		audioGetMute:                must("libvlc_audio_get_mute"),
		videoGetSpu:                 must("libvlc_video_get_spu"),
		videoSetSpu:                 must("libvlc_video_set_spu"),
		videoGetSpuDescription:      must("libvlc_video_get_spu_description"),
		videoSetKeyInput:            must("libvlc_video_set_key_input"),
		videoSetMouseInput:          must("libvlc_video_set_mouse_input"),
		trackDescriptionListRelease: must("libvlc_track_description_list_release"),
	}, nil
}

func (v *vlcAPI) call(p *windows.Proc, args ...uintptr) uintptr {
	r, _, _ := p.Call(args...)
	return r
}

func readTracks(head uintptr) []map[string]any {
	out := []map[string]any{}
	for head != 0 {
		td := (*trackDesc)(unsafe.Pointer(head))
		if td.Id >= 0 {
			out = append(out, map[string]any{
				"id":   td.Id,
				"name": cstr(td.Name),
			})
		}
		head = td.Next
	}
	return out
}

func emitTracks() {
	if vlc == nil || player == 0 {
		return
	}
	audioHead := vlc.call(vlc.audioGetTrackDescription, player)
	subHead := vlc.call(vlc.videoGetSpuDescription, player)
	audio := readTracks(audioHead)
	subs := readTracks(subHead)
	if audioHead != 0 {
		vlc.call(vlc.trackDescriptionListRelease, audioHead)
	}
	if subHead != 0 {
		vlc.call(vlc.trackDescriptionListRelease, subHead)
	}
	audioID, _, _ := vlc.audioGetTrack.Call(player)
	subID, _, _ := vlc.videoGetSpu.Call(player)
	emit(map[string]any{
		"type":    "tracks",
		"audio":   audio,
		"subs":    subs,
		"audioId": int32(audioID),
		"subId":   int32(subID),
	})
}

func isPortuguese(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "portug") || strings.Contains(n, "brazil") ||
		strings.Contains(n, "brasil") || strings.Contains(n, "pt-br") ||
		strings.Contains(n, "ptbr") || strings.Contains(n, "pob") ||
		strings.Contains(n, "[pt]") || strings.Contains(n, "portuguese")
}

func isEnglish(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "english") || strings.Contains(n, "inglês") ||
		strings.Contains(n, "ingles") || strings.Contains(n, "[en]") ||
		strings.Contains(n, "eng") || strings.Contains(n, "original")
}

func toInt32(v any) int32 {
	switch n := v.(type) {
	case int32:
		return n
	case int:
		return int32(n)
	case int64:
		return int32(n)
	case float64:
		return int32(n)
	default:
		return -1
	}
}

func applyPrefs() {
	defer func() {
		if r := recover(); r != nil {
			// Safely ignore any transient VLC track reflection errors
		}
	}()
	if prefsDone || vlc == nil || player == 0 {
		return
	}
	audioHead := vlc.call(vlc.audioGetTrackDescription, player)
	if audioHead == 0 {
		return
	}
	audio := readTracks(audioHead)
	vlc.call(vlc.trackDescriptionListRelease, audioHead)
	if len(audio) == 0 {
		return
	}

	if !userAudio {
		var pick int32 = -1
		if prefsAudio == "original" {
			for _, t := range audio {
				if isEnglish(fmt.Sprint(t["name"])) {
					pick = toInt32(t["id"])
					break
				}
			}
		} else {
			for _, t := range audio {
				if isPortuguese(fmt.Sprint(t["name"])) {
					pick = toInt32(t["id"])
					break
				}
			}
		}
		if pick >= 0 {
			vlc.call(vlc.audioSetTrack, player, uintptr(pick))
		}
	}

	subHead := vlc.call(vlc.videoGetSpuDescription, player)
	subs := readTracks(subHead)
	if subHead != 0 {
		vlc.call(vlc.trackDescriptionListRelease, subHead)
	}
	if !userSub {
		if prefsSubs == "never" {
			vlc.call(vlc.videoSetSpu, player, ^uintptr(0))
		} else {
			var pick int32 = -1
			for _, t := range subs {
				if isPortuguese(fmt.Sprint(t["name"])) {
					pick = toInt32(t["id"])
					break
				}
			}
			if pick >= 0 {
				vlc.call(vlc.videoSetSpu, player, uintptr(uint32(pick)))
			} else if prefsSubs != "always" {
				vlc.call(vlc.videoSetSpu, player, ^uintptr(0))
			}
		}
	}

	prefsDone = true
	emitTracks()
}

func playURL(url string) {
	mu.Lock()
	defer mu.Unlock()
	if vlc == nil || instance == 0 || url == "" {
		return
	}
	if player != 0 {
		vlc.call(vlc.mediaPlayerStop, player)
		vlc.call(vlc.mediaPlayerRelease, player)
		player = 0
	}
	if media != 0 {
		vlc.call(vlc.mediaRelease, media)
		media = 0
	}

	up, err := windows.BytePtrFromString(url)
	if err != nil {
		emit(map[string]any{"type": "error", "message": err.Error()})
		return
	}
	media = vlc.call(vlc.mediaNewLocation, instance, uintptr(unsafe.Pointer(up)))
	if media == 0 {
		emit(map[string]any{"type": "error", "message": "libvlc não abriu a URL"})
		return
	}
	for _, opt := range []string{":network-caching=4000", ":http-reconnect"} {
		op, _ := windows.BytePtrFromString(opt)
		vlc.call(vlc.mediaAddOption, media, uintptr(unsafe.Pointer(op)))
	}

	player = vlc.call(vlc.mediaPlayerNewFromMedia, media)
	if player == 0 {
		emit(map[string]any{"type": "error", "message": "falha ao criar media player"})
		return
	}
	vlc.call(vlc.mediaPlayerSetHWND, player, videoHWND)
	vlc.call(vlc.videoSetKeyInput, player, 0)
	vlc.call(vlc.videoSetMouseInput, player, 0)
	vlc.call(vlc.audioSetVolume, player, 90)
	startedSeek = false
	prefsDone = false
	if vlc.call(vlc.mediaPlayerPlay, player) < 0 {
		emit(map[string]any{"type": "error", "message": "falha ao reproduzir o arquivo original"})
		return
	}
	emit(map[string]any{"type": "playing"})
}

func handleCmd(c command) {
	switch c.Cmd {
	case "play":
		if c.StartMs > 0 {
			startMs = c.StartMs
		}
		u := c.URL
		go playURL(u)
	case "pause", "toggle":
		if player != 0 {
			vlc.call(vlc.mediaPlayerPause, player)
		}
	case "resume":
		if player != 0 {
			vlc.call(vlc.mediaPlayerSetPause, player, 0)
		}
	case "seek":
		if player != 0 {
			vlc.call(vlc.mediaPlayerSetTime, player, uintptr(c.Ms))
		}
	case "volume":
		if player != 0 {
			vlc.call(vlc.audioSetVolume, player, uintptr(int(c.Value)))
		}
	case "mute":
		if player != 0 {
			mv := uintptr(0)
			if c.Muted {
				mv = 1
			}
			vlc.call(vlc.audioSetMute, player, mv)
		}
	case "rate":
		if player != 0 {
			vlc.mediaPlayerSetRate.Call(player, uintptr(mathFloat32(float32(c.Value))))
		}
	case "audio":
		if player != 0 {
			userAudio = true
			vlc.call(vlc.audioSetTrack, player, uintptr(int32(c.ID)))
			emitTracks()
		}
	case "spu":
		if player != 0 {
			userSub = true
			vlc.call(vlc.videoSetSpu, player, uintptr(int32(c.ID)))
			emitTracks()
		}
	case "bounds":
		if videoHWND != 0 && c.W > 8 && c.H > 8 {
			procSetWindowPos.Call(videoHWND, hwndTop, uintptr(c.X), uintptr(c.Y), uintptr(c.W), uintptr(c.H),
				swpNoActivate|swpShowWindow)
			procShowWindow.Call(videoHWND, swShow)
		} else if videoHWND != 0 {
			procShowWindow.Call(videoHWND, 0) // SW_HIDE
		}
	case "quit":
		if player != 0 {
			vlc.call(vlc.mediaPlayerStop, player)
		}
		procDestroyWindow.Call(videoHWND)
	}
}

func mathFloat32(f float32) uint32 {
	return *(*uint32)(unsafe.Pointer(&f))
}

func cString(s string) uintptr {
	p, err := windows.BytePtrFromString(s)
	if err != nil {
		return 0
	}
	keepCStrings = append(keepCStrings, p)
	return uintptr(unsafe.Pointer(p))
}

func libvlcNew(v *vlcAPI, args []string) uintptr {
	if len(args) == 0 {
		return v.call(v.new_, 0, 0)
	}
	ptrs := make([]uintptr, len(args)+1)
	for i, a := range args {
		ptrs[i] = cString(a)
	}
	return v.call(v.new_, uintptr(len(args)), uintptr(unsafe.Pointer(&ptrs[0])))
}

func createVideoWindow(parent uintptr, x, y, w, h int32) (uintptr, error) {
	hInst, _, _ := procGetModuleHandleW.Call(0)
	clsName, _ := windows.UTF16PtrFromString("AuraStreamVlcHost")
	brush, _, _ := procGetStockObject.Call(blackBrush)
	wc := wndClassEx{
		cbSize:        uint32(unsafe.Sizeof(wndClassEx{})),
		style:         csHRedraw | csVRedraw,
		lpfnWndProc:   wndProcCallback,
		hInstance:     windows.Handle(hInst),
		hbrBackground: windows.Handle(brush),
		lpszClassName: clsName,
	}
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	if w < 64 {
		w = 64
	}
	if h < 64 {
		h = 64
	}

	// Owned popup — never SetParent into Chromium's HWND (that freezes Electron).
	ex := uintptr(wsExNoActivate | wsExToolWindow)
	style := uintptr(wsPopup | wsClipSiblings)
	hwnd, _, err := procCreateWindowExW.Call(
		ex,
		uintptr(unsafe.Pointer(clsName)),
		0,
		style,
		uintptr(x), uintptr(y), uintptr(w), uintptr(h),
		parent, 0, hInst, 0,
	)
	if hwnd == 0 {
		return 0, fmt.Errorf("CreateWindowEx: %v", err)
	}
	if parent != 0 {
		procSetWindowLongPtrW.Call(hwnd, gwlpHwndParent, parent)
	}
	procSetWindowPos.Call(hwnd, hwndTop, uintptr(x), uintptr(y), uintptr(w), uintptr(h),
		swpNoActivate|swpShowWindow|swpFrameChanged)
	procShowWindow.Call(hwnd, swShow)
	procUpdateWindow.Call(hwnd)
	return hwnd, nil
}

func parseArgs() (url string, parent uintptr, x, y, w, h int32) {
	w, h = 1280, 720
	prefsAudio = "pt-br"
	prefsSubs = "auto"
	args := os.Args[1:]
	for i := 0; i < len(args); i++ {
		next := func() string {
			if i+1 < len(args) {
				i++
				return args[i]
			}
			return ""
		}
		switch args[i] {
		case "--url":
			url = next()
		case "--parent-hwnd":
			var v uint64
			fmt.Sscanf(next(), "%d", &v)
			parent = uintptr(v)
		case "--x":
			fmt.Sscanf(next(), "%d", &x)
		case "--y":
			fmt.Sscanf(next(), "%d", &y)
		case "--w":
			fmt.Sscanf(next(), "%d", &w)
		case "--h":
			fmt.Sscanf(next(), "%d", &h)
		case "--start":
			var s float64
			fmt.Sscanf(next(), "%f", &s)
			startMs = int64(s * 1000)
		case "--prefer-audio":
			prefsAudio = strings.ToLower(next())
		case "--auto-subs":
			prefsSubs = strings.ToLower(next())
		case "--libvlc-dir":
			os.Chdir(next())
		}
	}
	return
}

func main() {
	shcore.NewProc("SetProcessDpiAwareness").Call(2)

	url, parent, x, y, w, h := parseArgs()
	parentHWND = parent

	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	if d := os.Getenv("AURA_LIBVLC_DIR"); d != "" {
		dir = d
	}

	var err error
	vlc, err = loadVLC(dir)
	if err != nil {
		emit(map[string]any{"type": "error", "message": err.Error()})
		os.Exit(1)
	}
	instance = libvlcNew(vlc, []string{
		"--intf=dummy",
		"--no-video-title-show",
		"--no-qt-error-dialogs",
		"--no-crashdump",
		"--quiet",
		"--avcodec-hw=any",
		"--network-caching=4000",
	})
	if instance == 0 {
		instance = vlc.call(vlc.new_, 0, 0)
	}
	if instance == 0 {
		emit(map[string]any{"type": "error", "message": "libvlc_new falhou"})
		os.Exit(1)
	}

	videoHWND, err = createVideoWindow(parent, x, y, w, h)
	if err != nil {
		emit(map[string]any{"type": "error", "message": err.Error()})
		os.Exit(1)
	}

	cmds := make(chan command, 64)
	go func() {
		sc := bufio.NewScanner(os.Stdin)
		buf := make([]byte, 0, 64*1024)
		sc.Buffer(buf, 1024*1024)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if line == "" {
				continue
			}
			var c command
			if err := json.Unmarshal([]byte(line), &c); err != nil {
				continue
			}
			cmds <- c
		}
		cmds <- command{Cmd: "quit"}
	}()

	if url != "" {
		go func() {
			time.Sleep(80 * time.Millisecond)
			cmds <- command{Cmd: "play", URL: url, StartMs: startMs}
		}()
	}

	lastTracks := time.Time{}
	lastTimeEmit := time.Time{}
	var msgBuf msg
	for {
		r, _, _ := procPeekMessageW.Call(uintptr(unsafe.Pointer(&msgBuf)), 0, 0, 0, pmRemove)
		if r != 0 {
			if msgBuf.message == wmQuit {
				break
			}
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&msgBuf)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&msgBuf)))
			continue
		}

		select {
		case c := <-cmds:
			handleCmd(c)
			if c.Cmd == "quit" {
				goto done
			}
		default:
			procMsgWait.Call(0, 0, 0, 15, 0x04FF)
		}

		if player != 0 {
			t, _, _ := vlc.mediaPlayerGetTime.Call(player)
			l, _, _ := vlc.mediaPlayerGetLength.Call(player)
			playing, _, _ := vlc.mediaPlayerIsPlaying.Call(player)
			if !startedSeek && startMs > 0 && int64(t) > 0 {
				vlc.call(vlc.mediaPlayerSetTime, player, uintptr(startMs))
				startedSeek = true
			}
			if playing != 0 && !prefsDone && time.Since(lastTracks) > 800*time.Millisecond {
				lastTracks = time.Now()
				applyPrefs()
			}
			if time.Since(lastTimeEmit) > 400*time.Millisecond {
				lastTimeEmit = time.Now()
				emit(map[string]any{
					"type":    "time",
					"t":       float64(int64(t)) / 1000.0,
					"d":       float64(int64(l)) / 1000.0,
					"playing": playing != 0,
				})
			}
		}
	}

done:
	if player != 0 {
		vlc.call(vlc.mediaPlayerStop, player)
		vlc.call(vlc.mediaPlayerRelease, player)
	}
	if media != 0 {
		vlc.call(vlc.mediaRelease, media)
	}
	if instance != 0 {
		vlc.call(vlc.release, instance)
	}
	emit(map[string]any{"type": "stopped"})
}
