package player

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

type trackDesc struct {
	Id   int32
	_    [4]byte
	Name uintptr
	Next uintptr
}

type Track struct {
	ID   int32
	Name string
}

type vlcAPI struct {
	dll                         *windows.DLL
	new_                        *windows.Proc
	release                     *windows.Proc
	mediaNewLocation            *windows.Proc
	mediaAddOption              *windows.Proc
	mediaRelease                *windows.Proc
	mediaPlayerNewFromMedia     *windows.Proc
	mediaPlayerRelease          *windows.Proc
	mediaPlayerSetHWND          *windows.Proc
	mediaPlayerPlay             *windows.Proc
	mediaPlayerPause            *windows.Proc
	mediaPlayerStop             *windows.Proc
	mediaPlayerIsPlaying        *windows.Proc
	mediaPlayerGetTime          *windows.Proc
	mediaPlayerSetTime          *windows.Proc
	mediaPlayerGetLength        *windows.Proc
	audioGetTrack               *windows.Proc
	audioSetTrack               *windows.Proc
	audioGetTrackDescription    *windows.Proc
	audioSetVolume              *windows.Proc
	audioSetMute                *windows.Proc
	audioGetMute                *windows.Proc
	videoGetSpu                 *windows.Proc
	videoSetSpu                 *windows.Proc
	videoGetSpuDescription      *windows.Proc
	videoSetKeyInput            *windows.Proc
	videoSetMouseInput          *windows.Proc
	trackDescriptionListRelease *windows.Proc
}

type Engine struct {
	api      *vlcAPI
	instance uintptr
	player   uintptr
	media    uintptr
}

func cstr(p uintptr) string {
	if p == 0 {
		return ""
	}
	return windows.BytePtrToString((*byte)(unsafe.Pointer(p)))
}

func FindLibVLCDir() string {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	candidates := []string{
		dir,
		filepath.Join(dir, "libvlc"),
		filepath.Join(dir, "AuraPlayer"),
		`C:\Program Files\VideoLAN\VLC`,
		`C:\Program Files (x86)\VideoLAN\VLC`,
	}
	if d := os.Getenv("AURA_LIBVLC_DIR"); d != "" {
		candidates = append([]string{d}, candidates...)
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "libvlc.dll")); err == nil {
			return c
		}
	}
	return ""
}

func loadVLC(dir string) (*vlcAPI, error) {
	dllPath := filepath.Join(dir, "libvlc.dll")
	os.Setenv("VLC_PLUGIN_PATH", filepath.Join(dir, "plugins"))
	os.Setenv("PATH", dir+";"+os.Getenv("PATH"))
	h, err := windows.LoadDLL(dllPath)
	if err != nil {
		return nil, fmt.Errorf("libvlc: %w", err)
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
		mediaPlayerGetTime:          must("libvlc_media_player_get_time"),
		mediaPlayerSetTime:          must("libvlc_media_player_set_time"),
		mediaPlayerGetLength:        must("libvlc_media_player_get_length"),
		audioGetTrack:               must("libvlc_audio_get_track"),
		audioSetTrack:               must("libvlc_audio_set_track"),
		audioGetTrackDescription:    must("libvlc_audio_get_track_description"),
		audioSetVolume:              must("libvlc_audio_set_volume"),
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

func NewEngine(libDir string) (*Engine, error) {
	api, err := loadVLC(libDir)
	if err != nil {
		return nil, err
	}
	inst, _, _ := api.new_.Call(0, 0)
	if inst == 0 {
		return nil, fmt.Errorf("libvlc_new falhou")
	}
	return &Engine{api: api, instance: inst}, nil
}

func (e *Engine) Play(url string, hwnd uintptr) error {
	e.Stop()
	up, err := windows.BytePtrFromString(url)
	if err != nil {
		return err
	}
	e.media = e.api.call(e.api.mediaNewLocation, e.instance, uintptr(unsafe.Pointer(up)))
	if e.media == 0 {
		return fmt.Errorf("não abriu a URL")
	}
	for _, opt := range []string{":network-caching=4000", ":http-reconnect"} {
		op, _ := windows.BytePtrFromString(opt)
		e.api.call(e.api.mediaAddOption, e.media, uintptr(unsafe.Pointer(op)))
	}
	e.player = e.api.call(e.api.mediaPlayerNewFromMedia, e.media)
	if e.player == 0 {
		return fmt.Errorf("falha ao criar o player")
	}
	e.api.call(e.api.mediaPlayerSetHWND, e.player, hwnd)
	e.api.call(e.api.videoSetKeyInput, e.player, 0)
	e.api.call(e.api.videoSetMouseInput, e.player, 0)
	e.api.call(e.api.audioSetVolume, e.player, 90)
	if e.api.call(e.api.mediaPlayerPlay, e.player) != 0 {
		return fmt.Errorf("falha ao reproduzir")
	}
	return nil
}

func (e *Engine) Stop() {
	if e.player != 0 {
		e.api.call(e.api.mediaPlayerStop, e.player)
		e.api.call(e.api.mediaPlayerRelease, e.player)
		e.player = 0
	}
	if e.media != 0 {
		e.api.call(e.api.mediaRelease, e.media)
		e.media = 0
	}
}

func (e *Engine) Close() {
	e.Stop()
	if e.instance != 0 {
		e.api.call(e.api.release, e.instance)
		e.instance = 0
	}
}

func (e *Engine) TogglePause() {
	if e.player != 0 {
		e.api.call(e.api.mediaPlayerPause, e.player)
	}
}

func (e *Engine) IsPlaying() bool {
	if e.player == 0 {
		return false
	}
	r, _, _ := e.api.mediaPlayerIsPlaying.Call(e.player)
	return r != 0
}

func (e *Engine) Time() (cur, total int64) {
	if e.player == 0 {
		return 0, 0
	}
	t, _, _ := e.api.mediaPlayerGetTime.Call(e.player)
	l, _, _ := e.api.mediaPlayerGetLength.Call(e.player)
	return int64(t), int64(l)
}

func (e *Engine) SetTime(ms int64) {
	if e.player != 0 {
		e.api.call(e.api.mediaPlayerSetTime, e.player, uintptr(ms))
	}
}

func (e *Engine) SetVolume(v int) {
	if e.player != 0 {
		e.api.call(e.api.audioSetVolume, e.player, uintptr(v))
	}
}

func (e *Engine) SetAudio(id int32) {
	if e.player != 0 {
		e.api.call(e.api.audioSetTrack, e.player, uintptr(id))
	}
}

func (e *Engine) SetSpu(id int32) {
	if e.player != 0 {
		e.api.call(e.api.videoSetSpu, e.player, uintptr(uint32(id)))
	}
}

func (e *Engine) AudioTracks() []Track {
	if e.player == 0 {
		return nil
	}
	head := e.api.call(e.api.audioGetTrackDescription, e.player)
	defer func() {
		if head != 0 {
			e.api.call(e.api.trackDescriptionListRelease, head)
		}
	}()
	return readTracks(head)
}

func (e *Engine) SubTracks() []Track {
	if e.player == 0 {
		return nil
	}
	head := e.api.call(e.api.videoGetSpuDescription, e.player)
	defer func() {
		if head != 0 {
			e.api.call(e.api.trackDescriptionListRelease, head)
		}
	}()
	return readTracks(head)
}

func (e *Engine) AudioID() int32 {
	if e.player == 0 {
		return -1
	}
	r, _, _ := e.api.audioGetTrack.Call(e.player)
	return int32(r)
}

func (e *Engine) SpuID() int32 {
	if e.player == 0 {
		return -1
	}
	r, _, _ := e.api.videoGetSpu.Call(e.player)
	return int32(r)
}

func readTracks(head uintptr) []Track {
	var out []Track
	for head != 0 {
		td := (*trackDesc)(unsafe.Pointer(head))
		if td.Id >= 0 {
			out = append(out, Track{ID: td.Id, Name: cstr(td.Name)})
		}
		head = td.Next
	}
	return out
}

func IsPortuguese(name string) bool {
	n := strings.ToLower(name)
	return strings.Contains(n, "portug") || strings.Contains(n, "brazil") ||
		strings.Contains(n, "brasil") || strings.Contains(n, "pt-br") ||
		strings.Contains(n, "ptbr") || strings.Contains(n, "pob") ||
		strings.Contains(n, "portuguese")
}
