package player

import (
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const wmNcHitTest = 0x0084

type inAppCmd struct {
	kind    string
	url     string
	startMs int64
	x, y    int32
	w, h    int32
	id      int32
	value   float64
	muted   bool
}

var inApp = struct {
	mu      sync.Mutex
	running bool
	hwnd    uintptr
	engine  *Engine
	cmds    chan inAppCmd
	start   int64
	seeked  bool
	prefs   bool
	lastX, lastY, lastW, lastH int32
}{
	cmds: make(chan inAppCmd, 64),
}

var eventHandler func(map[string]any)

func SetEventHandler(fn func(map[string]any)) {
	eventHandler = fn
}

func emitEvent(v map[string]any) {
	if eventHandler != nil {
		eventHandler(v)
	}
}

func FindAppHWND() uintptr {
	find := user32.NewProc("FindWindowW")
	for _, title := range []string{"AuraStream 4K", "AuraStream"} {
		h, _, _ := find.Call(0, uintptr(unsafe.Pointer(utf16(title))))
		if h != 0 {
			return h
		}
	}
	return 0
}

func overlayWndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	if message == wmNcHitTest {
		return ^uintptr(0) // HTTRANSPARENT — cliques passam para o React
	}
	if message == wmEraseBkg {
		return 1
	}
	if message == wmDestroy {
		procPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

var overlayProc = syscall.NewCallback(overlayWndProc)

func StartInApp(parent uintptr, url string, startMs int64, x, y, w, h int32) error {
	inApp.mu.Lock()
	running := inApp.running
	inApp.mu.Unlock()
	if running {
		select {
		case inApp.cmds <- inAppCmd{kind: "play", url: url, startMs: startMs}:
		default:
		}
		select {
		case inApp.cmds <- inAppCmd{kind: "bounds", x: x, y: y, w: w, h: h}:
		default:
		}
		return nil
	}
	if parent == 0 {
		parent = FindAppHWND()
	}
	if parent == 0 {
		return fmt.Errorf("janela do AuraStream não encontrada")
	}
	ready := make(chan error, 1)
	go func() {
		runtime.LockOSThread()
		ready <- runInApp(parent, url, startMs, x, y, w, h)
	}()
	select {
	case err := <-ready:
		return err
	case <-time.After(1500 * time.Millisecond):
		return nil
	}
}

func StopInApp() {
	select {
	case inApp.cmds <- inAppCmd{kind: "quit"}:
	default:
	}
	inApp.mu.Lock()
	hwnd := inApp.hwnd
	inApp.mu.Unlock()
	if hwnd != 0 {
		procPostMessageW.Call(hwnd, wmClose, 0, 0)
	}
}

func InAppBounds(x, y, w, h int32) {
	select {
	case inApp.cmds <- inAppCmd{kind: "bounds", x: x, y: y, w: w, h: h}:
	default:
	}
}

func cssToScreen(parent uintptr, x, y, w, h int32) (int32, int32, int32, int32) {
	if parent == 0 {
		parent = FindAppHWND()
	}
	scale := 1.0
	if parent != 0 && procGetDpiForWindow.Find() == nil {
		dpi, _, _ := procGetDpiForWindow.Call(parent)
		if dpi >= 96 {
			scale = float64(dpi) / 96.0
		}
	}
	pt := point{x: int32(float64(x) * scale), y: int32(float64(y) * scale)}
	if parent != 0 {
		procClientToScreen.Call(parent, uintptr(unsafe.Pointer(&pt)))
	}
	return pt.x, pt.y, int32(float64(w)*scale), int32(float64(h)*scale)
}

func InAppCommand(kind string, value float64, extra int32, muted bool) {
	select {
	case inApp.cmds <- inAppCmd{kind: kind, value: value, id: extra, muted: muted}:
	default:
	}
}

func runInApp(parent uintptr, url string, startMs int64, x, y, w, h int32) error {
	dir := FindLibVLCDir()
	if dir == "" {
		return fmt.Errorf("libvlc.dll não encontrado")
	}
	eng, err := NewEngine(dir)
	if err != nil {
		return err
	}

	hInst, _, _ := procGetModuleHandleW.Call(0)
	brush, _, _ := procGetStockObject.Call(blackBrush)
	registerClass("AuraStreamInAppVideo", overlayProc, hInst, brush)

	sx, sy, sw, sh := cssToScreen(parent, x, y, w, h)
	if sw < 64 {
		sw = 64
	}
	if sh < 64 {
		sh = 64
	}
	x, y, w, h = sx, sy, sw, sh

	hwnd, _, err2 := procCreateWindowExW.Call(
		wsExNoActivate|wsExToolWindow,
		uintptr(unsafe.Pointer(utf16("AuraStreamInAppVideo"))),
		0,
		wsPopup|wsVisible|wsClipSiblings,
		uintptr(x), uintptr(y), uintptr(w), uintptr(h),
		parent, 0, hInst, 0,
	)
	if hwnd == 0 {
		eng.Close()
		return fmt.Errorf("overlay CreateWindow: %v", err2)
	}

	inApp.mu.Lock()
	inApp.running = true
	inApp.hwnd = hwnd
	inApp.engine = eng
	inApp.start = startMs
	inApp.seeked = false
	inApp.prefs = false
	inApp.mu.Unlock()

	procShowWindow.Call(hwnd, swShow)
	procUpdateWindow.Call(hwnd)

	go func() {
		time.Sleep(60 * time.Millisecond)
		_ = eng.Play(url, hwnd)
	}()

	lastEmit := time.Time{}
	var m msg
	for {
		r, _, _ := procPeekMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0, 0x0001)
		if r != 0 {
			if m.message == wmQuit {
				break
			}
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
			continue
		}
		select {
		case c := <-inApp.cmds:
			if c.kind == "quit" {
				procDestroyWindow.Call(hwnd)
				continue
			}
			handleInApp(eng, hwnd, c)
		default:
			user32.NewProc("MsgWaitForMultipleObjects").Call(0, 0, 0, 20, 0x04FF)
		}
		if eng.player != 0 && time.Since(lastEmit) > 400*time.Millisecond {
			lastEmit = time.Now()
			cur, total := eng.Time()
			if !inApp.seeked && inApp.start > 0 && cur > 400 {
				eng.SetTime(inApp.start)
				inApp.seeked = true
			}
			if !inApp.prefs && len(eng.AudioTracks()) > 0 {
				applyInAppPrefs(eng)
				inApp.prefs = true
			}
			emitEvent(map[string]any{
				"type":    "time",
				"t":       float64(cur) / 1000.0,
				"d":       float64(total) / 1000.0,
				"playing": eng.IsPlaying(),
			})
		}
	}

	cur, total := eng.Time()
	emitEvent(map[string]any{
		"type":  "closed",
		"t":     float64(cur) / 1000.0,
		"d":     float64(total) / 1000.0,
	})
	eng.Close()
	inApp.mu.Lock()
	inApp.running = false
	inApp.hwnd = 0
	inApp.engine = nil
	inApp.mu.Unlock()
	if onClosedFn != nil {
		onClosedFn()
	}
	return nil
}

func handleInApp(eng *Engine, hwnd uintptr, c inAppCmd) {
	switch c.kind {
	case "play":
		inApp.start = c.startMs
		inApp.seeked = false
		inApp.prefs = false
		_ = eng.Play(c.url, hwnd)
	case "toggle":
		eng.TogglePause()
	case "seek":
		eng.SetTime(int64(c.value))
	case "volume":
		eng.SetVolume(int(c.value))
	case "mute":
		if c.muted {
			eng.SetVolume(0)
		} else {
			eng.SetVolume(90)
		}
	case "audio":
		eng.SetAudio(c.id)
		emitTracks(eng)
	case "spu":
		eng.SetSpu(c.id)
		emitTracks(eng)
	case "bounds":
		if c.w <= 8 || c.h <= 8 {
			procShowWindow.Call(hwnd, swHide)
			return
		}
		sx, sy, sw, sh := cssToScreen(FindAppHWND(), c.x, c.y, c.w, c.h)
		if sw < 8 || sh < 8 {
			return
		}
		if sx == inApp.lastX && sy == inApp.lastY && sw == inApp.lastW && sh == inApp.lastH {
			return
		}
		inApp.lastX, inApp.lastY, inApp.lastW, inApp.lastH = sx, sy, sw, sh
		procShowWindow.Call(hwnd, swShow)
		procSetWindowPos.Call(hwnd, 0, uintptr(sx), uintptr(sy), uintptr(sw), uintptr(sh), 0x0010)
	}
}

func applyInAppPrefs(eng *Engine) {
	for _, t := range eng.AudioTracks() {
		if IsPortuguese(t.Name) {
			eng.SetAudio(t.ID)
			break
		}
	}
	picked := false
	for _, t := range eng.SubTracks() {
		if IsPortuguese(t.Name) {
			eng.SetSpu(t.ID)
			picked = true
			break
		}
	}
	if !picked {
		eng.SetSpu(-1)
	}
	emitTracks(eng)
}

func emitTracks(eng *Engine) {
	audio := eng.AudioTracks()
	subs := eng.SubTracks()
	am := make([]map[string]any, 0, len(audio))
	for _, t := range audio {
		am = append(am, map[string]any{"id": t.ID, "name": t.Name})
	}
	sm := make([]map[string]any, 0, len(subs))
	for _, t := range subs {
		sm = append(sm, map[string]any{"id": t.ID, "name": t.Name})
	}
	emitEvent(map[string]any{
		"type":    "tracks",
		"audio":   am,
		"subs":    sm,
		"audioId": eng.AudioID(),
		"subId":   eng.SpuID(),
	})
}
