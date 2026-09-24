package player

import (
	"fmt"
	"runtime"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	wsChild        = 0x40000000
	wsVisible      = 0x10000000
	wsPopup        = 0x80000000
	wsClipSiblings = 0x04000000
	wsClipChildren = 0x02000000
	wsExNoActivate = 0x08000000
	wsExToolWindow = 0x00000080

	wmDestroy     = 0x0002
	wmSize        = 0x0005
	wmPaint       = 0x000F
	wmClose       = 0x0010
	wmQuit        = 0x0012
	wmEraseBkg    = 0x0014
	wmKeyDown     = 0x0100
	wmTimer       = 0x0113
	wmMouseMove   = 0x0200
	wmLButtonDown = 0x0201
	wmLButtonUp   = 0x0202
	wmLButtonDbl  = 0x0203
	wmMouseLeave  = 0x02A3
	wmMouseWheel  = 0x020A
	wmSetCursor   = 0x0020
	wmKillFocus   = 0x0008
	wmApp         = 0x8000

	swShow        = 5
	swHide        = 0
	hwndTop       = 0
	hwndBottom    = 1
	swpNoMove     = 0x0002
	swpNoSize     = 0x0001
	swpNoActivate = 0x0010
	swpShowWindow = 0x0040
	wsExLayered   = 0x00080000
	lwaAlpha      = 0x00000002
	idcArrow      = 32512
	idcHand       = 32649
	csHRedraw     = 0x0002
	csVRedraw     = 0x0001
	csDblClks     = 0x0008
	blackBrush    = 4
	transparent   = 1

	dtCenter      = 0x0001
	dtVCenter     = 0x0004
	dtSingleLine  = 0x0020
	dtEndEllipsis = 0x8000
	dtLeft        = 0

	vkEscape = 0x1B
	vkSpace  = 0x20
	vkLeft   = 0x25
	vkRight  = 0x27
	vkUp     = 0x26
	vkDown   = 0x28
	vkKeyA   = 0x41
	vkKeyS   = 0x53
	vkKeyK   = 0x4B
	vkKeyM   = 0x4D
	vkKeyF   = 0x46

	barTopH  = 72
	barBotH  = 108
	hitNone  = 0
	hitBack  = 1
	hitPlay  = 2
	hitRew   = 3
	hitFwd   = 4
	hitAudio = 5
	hitSubs  = 6
	hitSeek  = 7
	hitVol   = 8
	hitFull  = 9
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

type rect struct{ left, top, right, bottom int32 }

type paintstruct struct {
	hdc       uintptr
	erase     int32
	rc        rect
	restore   int32
	incUpdate int32
	reserved  [32]byte
}

type point struct{ x, y int32 }

var onClosedFn func()

// SetOnClosed is called when the native player window exits.
func SetOnClosed(fn func()) { onClosedFn = fn }

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")

	procCreateWindowExW            = user32.NewProc("CreateWindowExW")
	procRegisterClassExW           = user32.NewProc("RegisterClassExW")
	procDefWindowProcW             = user32.NewProc("DefWindowProcW")
	procGetMessageW                = user32.NewProc("GetMessageW")
	procTranslateMessage           = user32.NewProc("TranslateMessage")
	procDispatchMessageW           = user32.NewProc("DispatchMessageW")
	procShowWindow                 = user32.NewProc("ShowWindow")
	procUpdateWindow               = user32.NewProc("UpdateWindow")
	procDestroyWindow              = user32.NewProc("DestroyWindow")
	procGetClientRect              = user32.NewProc("GetClientRect")
	procMoveWindow                 = user32.NewProc("MoveWindow")
	procGetModuleHandleW           = kernel32.NewProc("GetModuleHandleW")
	procPostQuitMessage            = user32.NewProc("PostQuitMessage")
	procGetStockObject             = gdi32.NewProc("GetStockObject")
	procLoadCursorW                = user32.NewProc("LoadCursorW")
	procSetCursor                  = user32.NewProc("SetCursor")
	procSetTimer                   = user32.NewProc("SetTimer")
	procKillTimer                  = user32.NewProc("KillTimer")
	procSetFocus                   = user32.NewProc("SetFocus")
	procInvalidateRect             = user32.NewProc("InvalidateRect")
	procGetSystemMetrics           = user32.NewProc("GetSystemMetrics")
	procBeginPaint                 = user32.NewProc("BeginPaint")
	procEndPaint                   = user32.NewProc("EndPaint")
	procFillRect                   = user32.NewProc("FillRect")
	procSetTextColor               = gdi32.NewProc("SetTextColor")
	procSetBkMode                  = gdi32.NewProc("SetBkMode")
	procDrawTextW                  = user32.NewProc("DrawTextW")
	procSelectObject               = gdi32.NewProc("SelectObject")
	procCreateSolidBrush           = gdi32.NewProc("CreateSolidBrush")
	procCreatePen                  = gdi32.NewProc("CreatePen")
	procDeleteObject               = gdi32.NewProc("DeleteObject")
	procCreateFontW                = gdi32.NewProc("CreateFontW")
	procEllipse                    = gdi32.NewProc("Ellipse")
	procMoveToEx                   = gdi32.NewProc("MoveToEx")
	procLineTo                     = gdi32.NewProc("LineTo")
	procGetCursorPos               = user32.NewProc("GetCursorPos")
	procScreenToClient             = user32.NewProc("ScreenToClient")
	procSetCapture                 = user32.NewProc("SetCapture")
	procReleaseCapture             = user32.NewProc("ReleaseCapture")
	procGetWindowRect              = user32.NewProc("GetWindowRect")
	procSetWindowPos               = user32.NewProc("SetWindowPos")
	procPostMessageW               = user32.NewProc("PostMessageW")
	procPeekMessageW               = user32.NewProc("PeekMessageW")
	procClientToScreen             = user32.NewProc("ClientToScreen")
	procGetDpiForWindow            = user32.NewProc("GetDpiForWindow")
	procSetForegroundWindow        = user32.NewProc("SetForegroundWindow")
	procBringWindowToTop           = user32.NewProc("BringWindowToTop")
	procSetLayeredWindowAttributes = user32.NewProc("SetLayeredWindowAttributes")

	frameProc = syscall.NewCallback(frameWndProc)
	videoProc = syscall.NewCallback(videoWndProc)
	barProc   = syscall.NewCallback(barWndProc)
	menuProc  = syscall.NewCallback(menuWndProc)
	glassProc = syscall.NewCallback(glassWndProc)

	active *session
)

type session struct {
	engine                     *Engine
	frame                      uintptr
	video                      uintptr
	glass                      uintptr
	top                        uintptr
	bot                        uintptr
	menu                       uintptr
	parent                     uintptr
	hInst                      uintptr
	title                      string
	startMs                    int64
	seeked                     bool
	prefsOn                    bool
	volume                     int
	muted                      bool
	fullscreen                 bool
	chrome                     bool
	dragging                   bool
	dragVol                    bool
	hover                      int
	font                       uintptr
	fontSm                     uintptr
	fontBig                    uintptr
	menuKind                   int // 1 audio 2 subs
	menuItems                  []Track
	brushes                    []uintptr
	lastControlsTimer          time.Time
	dockX, dockY, dockW, dockH int32
}

func utf16(s string) *uint16 {
	p, _ := windows.UTF16PtrFromString(s)
	return p
}

func rgb(r, g, b uint8) uintptr {
	return uintptr(uint32(r) | uint32(g)<<8 | uint32(b)<<16)
}

func (s *session) brush(r, g, b uint8) uintptr {
	h, _, _ := procCreateSolidBrush.Call(rgb(r, g, b))
	s.brushes = append(s.brushes, h)
	return h
}

func (s *session) freeGDI() {
	for _, h := range s.brushes {
		procDeleteObject.Call(h)
	}
	s.brushes = nil
	if s.font != 0 {
		procDeleteObject.Call(s.font)
	}
	if s.fontSm != 0 {
		procDeleteObject.Call(s.fontSm)
	}
	if s.fontBig != 0 {
		procDeleteObject.Call(s.fontBig)
	}
}

func mkFont(px int, bold bool) uintptr {
	weight := uintptr(500)
	if bold {
		weight = 700
	}
	h, _, _ := procCreateFontW.Call(
		uintptr(int32(-px)), 0, 0, 0, weight,
		0, 0, 0, 1, 0, 0, 5, 0,
		uintptr(unsafe.Pointer(utf16("Segoe UI"))),
	)
	return h
}

func fill(hdc uintptr, r rect, col uintptr) {
	br, _, _ := procCreateSolidBrush.Call(col)
	procFillRect.Call(hdc, uintptr(unsafe.Pointer(&r)), br)
	procDeleteObject.Call(br)
}

func textOut(hdc, font uintptr, r rect, s string, col uintptr, flags uint32) {
	if font != 0 {
		procSelectObject.Call(hdc, font)
	}
	procSetBkMode.Call(hdc, transparent)
	procSetTextColor.Call(hdc, col)
	procDrawTextW.Call(hdc, uintptr(unsafe.Pointer(utf16(s))), uintptr(^uint32(0)), uintptr(unsafe.Pointer(&r)), uintptr(flags))
}

func fmtTime(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	sec := ms / 1000
	h := sec / 3600
	m := (sec % 3600) / 60
	s := sec % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}

func (s *session) client() rect {
	var rc rect
	procGetClientRect.Call(s.frame, uintptr(unsafe.Pointer(&rc)))
	return rc
}

func (s *session) layout() {
	rc := s.client()
	w, h := rc.right, rc.bottom
	procMoveWindow.Call(s.video, 0, 0, uintptr(w), uintptr(h), 1)
	if s.glass != 0 {
		procMoveWindow.Call(s.glass, 0, 0, uintptr(w), uintptr(h), 1)
	}
	procMoveWindow.Call(s.top, 0, 0, uintptr(w), uintptr(barTopH), 1)
	procMoveWindow.Call(s.bot, 0, uintptr(h-barBotH), uintptr(w), uintptr(barBotH), 1)
	// video embaixo, vidro (mouse) no meio, barras por cima — Netflix overlay
	procSetWindowPos.Call(s.video, hwndBottom, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
	if s.glass != 0 {
		procSetWindowPos.Call(s.glass, hwndTop, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
	}
	procSetWindowPos.Call(s.top, hwndTop, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
	procSetWindowPos.Call(s.bot, hwndTop, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
}

func parentClientScreen(parent uintptr) (x, y, w, h int32) {
	if parent == 0 {
		cx, _, _ := procGetSystemMetrics.Call(0)
		cy, _, _ := procGetSystemMetrics.Call(1)
		return 0, 0, int32(cx), int32(cy)
	}
	var rc rect
	procGetClientRect.Call(parent, uintptr(unsafe.Pointer(&rc)))
	pt := point{x: 0, y: 0}
	procClientToScreen.Call(parent, uintptr(unsafe.Pointer(&pt)))
	return pt.x, pt.y, rc.right, rc.bottom
}

func (s *session) dockToParent() {
	x, y, w, h := parentClientScreen(s.parent)
	if w < 40 || h < 40 {
		procShowWindow.Call(s.frame, swHide)
		return
	}
	if x == s.dockX && y == s.dockY && w == s.dockW && h == s.dockH {
		procSetWindowPos.Call(s.frame, hwndTop, 0, 0, 0, 0, swpNoMove|swpNoSize|swpNoActivate)
		return
	}
	s.dockX, s.dockY, s.dockW, s.dockH = x, y, w, h
	procShowWindow.Call(s.frame, swShow)
	procSetWindowPos.Call(s.frame, hwndTop, uintptr(x), uintptr(y), uintptr(w), uintptr(h), swpNoActivate|swpShowWindow)
	s.layout()
}

var fullscreenToggle func() bool

func SetFullscreenToggle(fn func() bool) { fullscreenToggle = fn }

func (s *session) toggleFullscreen() {
	if fullscreenToggle == nil {
		return
	}
	// Do not carry painted controls through the OS resize animation. Windows can
	// briefly preserve both the old and new popup surfaces, which looks like a
	// duplicated control bar on the first fullscreen transition.
	s.closeMenu()
	procKillTimer.Call(s.frame, 2)
	s.chrome = false
	procShowWindow.Call(s.top, swHide)
	procShowWindow.Call(s.bot, swHide)
	s.fullscreen = fullscreenToggle()
	s.dockToParent()
	procKillTimer.Call(s.frame, 4)
	procSetTimer.Call(s.frame, 4, 220, 0)
}

func (s *session) showChrome() {
	if s.engine == nil {
		return
	}
	_, total := s.engine.Time()
	if total <= 0 {
		// Until VLC has parsed the media, this would paint a misleading
		// 00:00 / 00:00 bar on top of the web loading controls.
		return
	}
	becameVisible := !s.chrome
	s.chrome = true
	if becameVisible {
		procShowWindow.Call(s.top, swShow)
		procShowWindow.Call(s.bot, swShow)
		// The bars paint their complete background. Erasing first creates a
		// visible flash between WM_ERASEBKGND and WM_PAINT.
		procInvalidateRect.Call(s.top, 0, 0)
		procInvalidateRect.Call(s.bot, 0, 0)
	}

	// WM_MOUSEMOVE can fire hundreds of times per second. Refresh the hide
	// timer at a human-scale cadence without repeatedly touching the windows.
	now := time.Now()
	if becameVisible || now.Sub(s.lastControlsTimer) >= 150*time.Millisecond {
		procKillTimer.Call(s.frame, 2)
		if s.engine.IsPlaying() {
			procSetTimer.Call(s.frame, 2, 2800, 0)
		}
		s.lastControlsTimer = now
	}
}

func (s *session) hideChrome() {
	if s.menu != 0 {
		return
	}
	if !s.engine.IsPlaying() {
		return
	}
	s.chrome = false
	procKillTimer.Call(s.frame, 2)
	procShowWindow.Call(s.top, swHide)
	procShowWindow.Call(s.bot, swHide)
}

func (s *session) noteMouse() {
	s.showChrome()
}

func applyPrefs(s *session) {
	if s.prefsOn || s.engine.player == 0 {
		return
	}
	audio := s.engine.AudioTracks()
	if len(audio) == 0 {
		return
	}
	for _, t := range audio {
		if IsPortuguese(t.Name) {
			s.engine.SetAudio(t.ID)
			break
		}
	}
	subs := s.engine.SubTracks()
	picked := false
	for _, t := range subs {
		if IsPortuguese(t.Name) {
			s.engine.SetSpu(t.ID)
			picked = true
			break
		}
	}
	if !picked {
		s.engine.SetSpu(-1)
	}
	s.prefsOn = true
	audio = s.engine.AudioTracks()
	subs = s.engine.SubTracks()
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
		"audioId": s.engine.AudioID(),
		"subId":   s.engine.SpuID(),
	})
}

func volOrigin(w int32) int32 {
	vx := w - 520
	if vx < 450 {
		vx = 450
	}
	return vx
}

func hitBottom(x, y, w int32) int {
	if y < 22 {
		return hitSeek
	}
	vx := volOrigin(w)
	if x >= vx && x < vx+130 && y >= 40 && y <= 84 {
		return hitVol
	}
	by := int32(40)
	bh := int32(44)
	if y < by || y > by+bh {
		return hitNone
	}
	switch {
	case x >= 18 && x < 70:
		return hitBack
	case x >= 78 && x < 138:
		return hitPlay
	case x >= 148 && x < 200:
		return hitRew
	case x >= 208 && x < 260:
		return hitFwd
	case x >= w-380 && x < w-280:
		return hitAudio
	case x >= w-270 && x < w-105:
		return hitSubs
	case x >= w-94 && x < w-24:
		return hitFull
	}
	return hitNone
}

func paintTop(s *session, hdc uintptr, w, h int32) {
	fill(hdc, rect{0, 0, w, h}, rgb(10, 10, 12))
	// back pill
	fill(hdc, rect{20, 16, 118, 56}, rgb(32, 32, 36))
	if s.hover == hitBack {
		fill(hdc, rect{20, 16, 118, 56}, rgb(50, 50, 56))
	}
	textOut(hdc, s.font, rect{20, 16, 118, 56}, "←  Voltar", rgb(255, 255, 255), dtCenter|dtVCenter|dtSingleLine)
	textOut(hdc, s.fontBig, rect{136, 8, w - 24, 40}, s.title, rgb(250, 250, 250), dtLeft|dtVCenter|dtSingleLine|dtEndEllipsis)
	textOut(hdc, s.fontSm, rect{136, 38, w - 24, 62}, "Arquivo original  ·  motor VLC  ·  A áudio   S legendas   F tela cheia   Esc voltar", rgb(160, 160, 168), dtLeft|dtVCenter|dtSingleLine)
}

func paintBottom(s *session, hdc uintptr, w, h int32) {
	fill(hdc, rect{0, 0, w, h}, rgb(10, 10, 12))
	cur, total := s.engine.Time()
	prog := 0.0
	if total > 0 {
		prog = float64(cur) / float64(total)
		if prog > 1 {
			prog = 1
		}
	}
	// seek track
	tx, ty, tw, th := int32(24), int32(14), w-48, int32(6)
	fill(hdc, rect{tx, ty, tx + tw, ty + th}, rgb(58, 58, 64))
	pw := int32(float64(tw) * prog)
	if pw > 0 {
		fill(hdc, rect{tx, ty, tx + pw, ty + th}, rgb(229, 9, 20))
	}
	kx := tx + pw
	fill(hdc, rect{kx - 6, ty - 4, kx + 6, ty + th + 4}, rgb(255, 255, 255))

	drawPill := func(x1, x2 int32, label string, hot bool, play bool) {
		bgc := rgb(32, 32, 36)
		if play {
			bgc = rgb(229, 9, 20)
		} else if hot {
			bgc = rgb(50, 50, 58)
		}
		fill(hdc, rect{x1, 40, x2, 84}, bgc)
		textOut(hdc, s.font, rect{x1, 40, x2, 84}, label, rgb(255, 255, 255), dtCenter|dtVCenter|dtSingleLine)
	}
	drawPill(18, 70, "←", s.hover == hitBack, false)
	playLbl := "▶"
	if s.engine.IsPlaying() {
		playLbl = "❚❚"
	}
	drawPill(78, 138, playLbl, s.hover == hitPlay, true)
	drawPill(148, 200, "−10", s.hover == hitRew, false)
	drawPill(208, 260, "+10", s.hover == hitFwd, false)

	textOut(hdc, s.font, rect{272, 40, 430, 84}, fmtTime(cur)+"  /  "+fmtTime(total), rgb(210, 210, 216), dtLeft|dtVCenter|dtSingleLine)

	// volume
	vx := volOrigin(w)
	vol := s.volume
	if s.muted {
		vol = 0
	}
	textOut(hdc, s.fontSm, rect{vx, 40, vx + 36, 84}, "🔊", rgb(230, 230, 230), dtCenter|dtVCenter|dtSingleLine)
	fill(hdc, rect{vx + 40, 58, vx + 120, 64}, rgb(58, 58, 64))
	vw := int32(float64(80) * float64(vol) / 100)
	fill(hdc, rect{vx + 40, 58, vx + 40 + vw, 64}, rgb(250, 250, 250))

	aName := "Áudio"
	if ts := s.engine.AudioTracks(); len(ts) > 0 {
		id := s.engine.AudioID()
		for _, t := range ts {
			if t.ID == id {
				aName = shortName(t.Name, "Áudio")
				break
			}
		}
		aName = fmt.Sprintf("Áudio  ·  %d", len(ts))
	}
	sName := "Legendas"
	if ts := s.engine.SubTracks(); len(ts) > 0 {
		sName = fmt.Sprintf("Legendas  ·  %d", len(ts))
	}
	drawPill(w-380, w-280, aName, s.hover == hitAudio, false)
	drawPill(w-270, w-105, sName, s.hover == hitSubs, false)
	fullLabel := "⛶"
	if s.fullscreen {
		fullLabel = "Sair ⛶"
	}
	drawPill(w-94, w-24, fullLabel, s.hover == hitFull, false)
}

func shortName(name, fallback string) string {
	if name == "" {
		return fallback
	}
	r := []rune(name)
	if len(r) > 18 {
		return string(r[:16]) + "…"
	}
	return name
}

func paintMenu(s *session, hdc uintptr, w, h int32) {
	fill(hdc, rect{0, 0, w, h}, rgb(18, 18, 22))
	itemH := int32(40)
	title := "Faixas de áudio"
	if s.menuKind == 2 {
		title = "Legendas"
	}
	textOut(hdc, s.fontSm, rect{16, 8, w - 16, 32}, title, rgb(160, 160, 168), dtLeft|dtVCenter|dtSingleLine)
	off := int32(40)
	if s.menuKind == 2 {
		fill(hdc, rect{8, off, w - 8, off + itemH}, rgb(28, 28, 32))
		label := "Desativadas"
		if s.engine.SpuID() < 0 {
			label = "✓  Desativadas"
		}
		textOut(hdc, s.font, rect{16, off, w - 16, off + itemH}, label, rgb(255, 255, 255), dtLeft|dtVCenter|dtSingleLine)
		off += itemH
	}
	curA, curS := s.engine.AudioID(), s.engine.SpuID()
	for _, t := range s.menuItems {
		sel := (s.menuKind == 1 && t.ID == curA) || (s.menuKind == 2 && t.ID == curS)
		if sel {
			fill(hdc, rect{8, off, w - 8, off + itemH}, rgb(229, 9, 20))
		}
		name := t.Name
		if sel {
			name = "✓  " + name
		}
		textOut(hdc, s.font, rect{16, off, w - 16, off + itemH}, name, rgb(255, 255, 255), dtLeft|dtVCenter|dtSingleLine)
		off += itemH
	}
}

func (s *session) openMenu(kind int) {
	s.closeMenu()
	s.menuKind = kind
	if kind == 1 {
		s.menuItems = s.engine.AudioTracks()
	} else {
		s.menuItems = s.engine.SubTracks()
	}
	n := len(s.menuItems)
	if kind == 2 {
		n++
	}
	if n == 0 {
		n = 1
	}
	mh := int32(48 + n*40)
	mw := int32(300)
	var rc rect
	procGetWindowRect.Call(s.bot, uintptr(unsafe.Pointer(&rc)))
	x := rc.right - 270 - mw
	if kind == 1 {
		x = rc.right - 380 - mw
	}
	y := rc.top - mh - 8
	s.menu, _, _ = procCreateWindowExW.Call(
		wsExToolWindow,
		uintptr(unsafe.Pointer(utf16("AuraStreamGoMenu"))),
		0,
		wsPopup|wsVisible|wsClipSiblings,
		uintptr(x), uintptr(y), uintptr(mw), uintptr(mh),
		s.frame, 0, s.hInst, 0,
	)
	procInvalidateRect.Call(s.menu, 0, 0)
}

func (s *session) closeMenu() {
	if s.menu != 0 {
		procDestroyWindow.Call(s.menu)
		s.menu = 0
	}
}

func (s *session) clickMenu(y int32) {
	itemH := int32(40)
	off := int32(40)
	if s.menuKind == 2 {
		if y >= off && y < off+itemH {
			s.engine.SetSpu(-1)
			s.closeMenu()
			s.showChrome()
			return
		}
		off += itemH
	}
	idx := int((y - off) / itemH)
	if idx >= 0 && idx < len(s.menuItems) {
		if s.menuKind == 1 {
			s.engine.SetAudio(s.menuItems[idx].ID)
		} else {
			s.engine.SetSpu(s.menuItems[idx].ID)
		}
	}
	s.closeMenu()
	s.showChrome()
}

func (s *session) seekAt(x, w int32) {
	_, total := s.engine.Time()
	if total <= 0 || w <= 48 {
		return
	}
	p := float64(x-24) / float64(w-48)
	if p < 0 {
		p = 0
	}
	if p > 1 {
		p = 1
	}
	s.engine.SetTime(int64(p * float64(total)))
}

func (s *session) volAt(x, w int32) {
	vx := volOrigin(w) + 40
	p := float64(x-vx) / 80
	if p < 0 {
		p = 0
	}
	if p > 1 {
		p = 1
	}
	s.volume = int(p * 100)
	s.muted = s.volume == 0
	s.engine.SetVolume(s.volume)
}

func (s *session) onBottomDown(x, y, w int32) {
	hit := hitBottom(x, y, w)
	s.hover = hit
	switch hit {
	case hitSeek:
		s.dragging = true
		procSetCapture.Call(s.bot)
		s.seekAt(x, w)
	case hitVol:
		s.dragVol = true
		procSetCapture.Call(s.bot)
		s.volAt(x, w)
	case hitBack:
		procDestroyWindow.Call(s.frame)
	case hitPlay:
		s.engine.TogglePause()
		s.showChrome()
	case hitRew:
		cur, _ := s.engine.Time()
		s.engine.SetTime(max64(0, cur-10000))
	case hitFwd:
		cur, total := s.engine.Time()
		n := cur + 10000
		if total > 0 && n > total {
			n = total
		}
		s.engine.SetTime(n)
	case hitAudio:
		s.openMenu(1)
	case hitSubs:
		s.openMenu(2)
	case hitFull:
		s.toggleFullscreen()
	}
	procInvalidateRect.Call(s.bot, 0, 0)
}

func barWndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	s := active
	if s == nil {
		r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
		return r
	}
	x := int32(lparam & 0xFFFF)
	y := int32((lparam >> 16) & 0xFFFF)
	var rc rect
	procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
	w := rc.right
	switch message {
	case wmPaint:
		var ps paintstruct
		hdc, _, _ := procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		if hwnd == s.top {
			paintTop(s, hdc, rc.right, rc.bottom)
		} else {
			paintBottom(s, hdc, rc.right, rc.bottom)
		}
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	case wmEraseBkg:
		return 1
	case wmMouseMove:
		s.noteMouse()
		if s.dragging && hwnd == s.bot {
			s.seekAt(x, w)
			procInvalidateRect.Call(s.bot, 0, 0)
			return 0
		}
		if s.dragVol && hwnd == s.bot {
			s.volAt(x, w)
			procInvalidateRect.Call(s.bot, 0, 0)
			return 0
		}
		previousHover := s.hover
		if hwnd == s.bot {
			s.hover = hitBottom(x, y, w)
		} else if x >= 20 && x < 118 {
			s.hover = hitBack
		} else {
			s.hover = hitNone
		}
		hand := s.hover != hitNone
		cur := idcArrow
		if hand {
			cur = idcHand
		}
		c, _, _ := procLoadCursorW.Call(0, uintptr(uint16(cur)))
		procSetCursor.Call(c)
		if previousHover != s.hover {
			procInvalidateRect.Call(hwnd, 0, 0)
		}
		return 0
	case wmLButtonDown:
		s.noteMouse()
		s.grabFocus()
		if hwnd == s.top && x >= 20 && x < 118 {
			procDestroyWindow.Call(s.frame)
			return 0
		}
		if hwnd == s.bot {
			s.onBottomDown(x, y, w)
		}
		return 0
	case wmLButtonUp:
		if s.dragging || s.dragVol {
			s.dragging = false
			s.dragVol = false
			procReleaseCapture.Call()
		}
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

func menuWndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	s := active
	if s == nil {
		r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
		return r
	}
	switch message {
	case wmPaint:
		var ps paintstruct
		hdc, _, _ := procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		var rc rect
		procGetClientRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
		paintMenu(s, hdc, rc.right, rc.bottom)
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	case wmEraseBkg:
		return 1
	case wmLButtonUp:
		y := int32((lparam >> 16) & 0xFFFF)
		s.clickMenu(y)
		return 0
	case wmKillFocus:
		s.closeMenu()
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

func (s *session) grabFocus() {
	procSetForegroundWindow.Call(s.frame)
	procSetFocus.Call(s.frame)
	procBringWindowToTop.Call(s.frame)
}

func (s *session) clickVideo() {
	s.grabFocus()
	s.engine.TogglePause()
	s.showChrome()
	if s.bot != 0 {
		procInvalidateRect.Call(s.bot, 0, 0)
	}
}

func glassWndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	s := active
	if s == nil {
		r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
		return r
	}
	switch message {
	case wmEraseBkg:
		return 1
	case wmPaint:
		var ps paintstruct
		procBeginPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		procEndPaint.Call(hwnd, uintptr(unsafe.Pointer(&ps)))
		return 0
	case wmMouseMove:
		s.noteMouse()
		return 0
	case wmLButtonDown:
		s.clickVideo()
		return 0
	case wmLButtonUp:
		return 0
	case wmLButtonDbl:
		s.toggleFullscreen()
		return 0
	case wmMouseWheel:
		delta := int16(uint16(wparam >> 16))
		if delta > 0 {
			s.volume = minInt(100, s.volume+5)
		} else {
			s.volume = maxInt(0, s.volume-5)
		}
		s.muted = s.volume == 0
		s.engine.SetVolume(s.volume)
		s.showChrome()
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

func videoWndProc(hwnd, msg, wparam, lparam uintptr) uintptr {
	switch msg {
	case wmEraseBkg:
		return 1
	case wmNcHitTest:
		return ^uintptr(0) // HTTRANSPARENT — o vidro/frame recebe o mouse
	case wmMouseMove:
		if active != nil {
			active.noteMouse()
		}
	case wmLButtonDown:
		if active != nil {
			active.clickVideo()
		}
		return 0
	case wmLButtonUp:
		return 0
	case wmLButtonDbl:
		if active != nil {
			active.toggleFullscreen()
		}
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, msg, wparam, lparam)
	return r
}

func frameWndProc(hwnd, message, wparam, lparam uintptr) uintptr {
	s := active
	switch message {
	case wmSize:
		if s != nil {
			s.layout()
		}
		return 0
	case wmMouseMove:
		if s != nil {
			s.noteMouse()
		}
	case wmLButtonDown:
		if s != nil {
			s.clickVideo()
		}
		return 0
	case wmLButtonUp:
		return 0
	case wmLButtonDbl:
		if s != nil {
			s.toggleFullscreen()
		}
		return 0
	case wmApp:
		if s != nil {
			handleCommand(s, wparam, lparam)
		}
		return 0
	case wmTimer:
		if s == nil {
			return 0
		}
		if wparam == 2 {
			s.hideChrome()
			return 0
		}
		if wparam == 3 {
			if s != nil {
				s.dockToParent()
			}
			return 0
		}
		if wparam == 4 {
			procKillTimer.Call(s.frame, 4)
			s.dockToParent()
			s.showChrome()
			return 0
		}
		if s.engine.player != 0 {
			cur, total := s.engine.Time()
			if !s.seeked && s.startMs > 0 && cur > 400 {
				s.engine.SetTime(s.startMs)
				s.seeked = true
			}
			applyPrefs(s)
			if total > 0 && !s.chrome {
				s.showChrome()
			}
			emitEvent(map[string]any{
				"type":    "time",
				"t":       float64(cur) / 1000.0,
				"d":       float64(total) / 1000.0,
				"playing": s.engine.IsPlaying(),
			})
			if s.chrome {
				procInvalidateRect.Call(s.bot, 0, 0)
				procInvalidateRect.Call(s.top, 0, 0)
			}
		}
		return 0
	case wmKeyDown:
		if s == nil {
			return 0
		}
		switch wparam {
		case vkEscape:
			if s.menu != 0 {
				s.closeMenu()
				return 0
			}
			if s.fullscreen {
				s.toggleFullscreen()
			} else {
				procDestroyWindow.Call(hwnd)
			}
		case vkSpace, vkKeyK:
			s.engine.TogglePause()
			s.showChrome()
		case vkLeft:
			cur, _ := s.engine.Time()
			s.engine.SetTime(max64(0, cur-10000))
		case vkRight:
			cur, _ := s.engine.Time()
			s.engine.SetTime(cur + 10000)
		case vkUp:
			s.volume = minInt(100, s.volume+5)
			s.engine.SetVolume(s.volume)
		case vkDown:
			s.volume = maxInt(0, s.volume-5)
			s.engine.SetVolume(s.volume)
		case vkKeyM:
			s.muted = !s.muted
			if s.muted {
				s.engine.SetVolume(0)
			} else {
				s.engine.SetVolume(s.volume)
			}
		case vkKeyF:
			s.toggleFullscreen()
		case vkKeyA:
			s.showChrome()
			s.openMenu(1)
		case vkKeyS:
			s.showChrome()
			s.openMenu(2)
		}
		if s.chrome {
			procInvalidateRect.Call(s.bot, 0, 0)
		}
		return 0
	case wmDestroy:
		if s != nil {
			procKillTimer.Call(hwnd, 1)
			procKillTimer.Call(hwnd, 2)
			procKillTimer.Call(hwnd, 3)
			procKillTimer.Call(hwnd, 4)
			cur, total := int64(0), int64(0)
			if s.engine != nil {
				cur, total = s.engine.Time()
			}
			emitEvent(map[string]any{
				"type": "closed",
				"t":    float64(cur) / 1000.0,
				"d":    float64(total) / 1000.0,
			})
			s.closeMenu()
			s.engine.Close()
			s.freeGDI()
			active = nil
		}
		procPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := procDefWindowProcW.Call(hwnd, message, wparam, lparam)
	return r
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func registerClass(name string, proc, hInst, bg uintptr) {
	cls := utf16(name)
	wc := wndClassEx{
		cbSize:        uint32(unsafe.Sizeof(wndClassEx{})),
		style:         csHRedraw | csVRedraw | csDblClks,
		lpfnWndProc:   proc,
		hInstance:     windows.Handle(hInst),
		hbrBackground: windows.Handle(bg),
		lpszClassName: cls,
	}
	cur, _, _ := procLoadCursorW.Call(0, idcArrow)
	wc.hCursor = windows.Handle(cur)
	procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
}

func createChild(class string, style, x, y, w, h, parent, hInst uintptr) uintptr {
	return createChildEx(class, 0, style, x, y, w, h, parent, hInst)
}

func createChildEx(class string, ex, style, x, y, w, h, parent, hInst uintptr) uintptr {
	hwnd, _, _ := procCreateWindowExW.Call(
		ex, uintptr(unsafe.Pointer(utf16(class))), 0, style,
		x, y, w, h, parent, 0, hInst, 0,
	)
	return hwnd
}

func handleCommand(s *session, wparam, lparam uintptr) {
	switch wparam {
	case 1:
		s.engine.TogglePause()
		s.showChrome()
	case 2:
		s.engine.SetTime(int64(lparam))
	case 3:
		s.volume = int(lparam)
		if s.volume < 0 {
			s.volume = 0
		}
		if s.volume > 100 {
			s.volume = 100
		}
		s.muted = s.volume == 0
		s.engine.SetVolume(s.volume)
	case 4:
		s.muted = lparam != 0
		if s.muted {
			s.engine.SetVolume(0)
		} else {
			s.engine.SetVolume(s.volume)
		}
	case 5:
		s.engine.SetAudio(int32(lparam))
	case 6:
		s.engine.SetSpu(int32(lparam))
	}
	if s.chrome && s.bot != 0 {
		procInvalidateRect.Call(s.bot, 0, 0)
	}
}

// Command drives the docked GDI player from the Wails UI thread.
func Command(kind string, value float64, extra int32, muted bool) {
	s := active
	if s == nil || s.frame == 0 {
		InAppCommand(kind, value, extra, muted)
		return
	}
	var wp, lp uintptr
	switch kind {
	case "toggle", "pause":
		wp = 1
	case "seek":
		wp = 2
		lp = uintptr(int64(value))
	case "volume":
		wp = 3
		lp = uintptr(int64(value))
	case "mute":
		wp = 4
		if muted {
			lp = 1
		}
	case "audio":
		wp = 5
		lp = uintptr(uint32(extra))
	case "spu":
		wp = 6
		lp = uintptr(uint32(extra))
	default:
		return
	}
	procPostMessageW.Call(s.frame, wmApp, wp, lp)
}

// StopActive closes the native player if it is open.
func StopActive() {
	StopInApp()
	s := active
	if s == nil || s.frame == 0 {
		return
	}
	procPostMessageW.Call(s.frame, wmClose, 0, 0)
}

// Play opens a native player docked to the AuraStream window.
func Play(url, title string, startSeconds float64) error {
	return PlayInHost(FindAppHWND(), url, title, startSeconds)
}

func PlayInHost(parent uintptr, url, title string, startSeconds float64) error {
	StopActive()
	for i := 0; i < 40 && active != nil; i++ {
		time.Sleep(25 * time.Millisecond)
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
		_ = run(url, title, startSeconds, parent, ready)
	}()
	select {
	case err := <-ready:
		return err
	case <-time.After(2 * time.Second):
		return fmt.Errorf("tempo esgotado ao criar a janela do player")
	}
}

func run(url, title string, startSeconds float64, parent uintptr, ready chan<- error) error {
	dir := FindLibVLCDir()
	if dir == "" {
		err := fmt.Errorf("libvlc.dll não encontrado ao lado do AuraStream.exe")
		ready <- err
		return err
	}
	eng, err := NewEngine(dir)
	if err != nil {
		ready <- err
		return err
	}
	hInst, _, _ := procGetModuleHandleW.Call(0)
	brush, _, _ := procGetStockObject.Call(blackBrush)
	registerClass("AuraStreamGoFrame", frameProc, hInst, brush)
	registerClass("AuraStreamGoVideo", videoProc, hInst, brush)
	registerClass("AuraStreamGoGlass", glassProc, hInst, 0)
	registerClass("AuraStreamGoBar", barProc, hInst, 0)
	registerClass("AuraStreamGoMenu", menuProc, hInst, 0)

	px, py, cx, cy := parentClientScreen(parent)
	style := uintptr(wsPopup | wsVisible | wsClipChildren | wsClipSiblings)
	frame, _, err2 := procCreateWindowExW.Call(
		wsExToolWindow,
		uintptr(unsafe.Pointer(utf16("AuraStreamGoFrame"))),
		uintptr(unsafe.Pointer(utf16(title+" — AuraStream"))),
		style,
		uintptr(px), uintptr(py), uintptr(cx), uintptr(cy),
		parent, 0, hInst, 0,
	)
	if frame == 0 {
		eng.Close()
		err := fmt.Errorf("CreateWindow: %v", err2)
		ready <- err
		return err
	}

	video := createChild("AuraStreamGoVideo", wsChild|wsVisible|wsClipSiblings, 0, 0, uintptr(cx), uintptr(cy), frame, hInst)
	glass := createChildEx("AuraStreamGoGlass", wsExLayered, wsChild|wsVisible|wsClipSiblings, 0, 0, uintptr(cx), uintptr(cy), frame, hInst)
	if glass != 0 {
		ok, _, _ := procSetLayeredWindowAttributes.Call(glass, 0, 1, lwaAlpha)
		if ok == 0 {
			procDestroyWindow.Call(glass)
			glass = 0
		}
	}
	// Controls start hidden and are revealed only after VLC reports a valid
	// duration. This prevents the temporary duplicate 00:00 / 00:00 chrome.
	top := createChild("AuraStreamGoBar", wsChild|wsClipSiblings, 0, 0, uintptr(cx), uintptr(barTopH), frame, hInst)
	bot := createChild("AuraStreamGoBar", wsChild|wsClipSiblings, 0, uintptr(cy-barBotH), uintptr(cx), uintptr(barBotH), frame, hInst)

	s := &session{
		engine:  eng,
		frame:   frame,
		video:   video,
		glass:   glass,
		top:     top,
		bot:     bot,
		parent:  parent,
		hInst:   hInst,
		title:   title,
		startMs: int64(startSeconds * 1000),
		volume:  90,
		chrome:  false,
		font:    mkFont(15, true),
		fontSm:  mkFont(12, false),
		fontBig: mkFont(18, true),
	}
	active = s
	s.layout()
	procShowWindow.Call(frame, swShow)
	procUpdateWindow.Call(frame)
	s.grabFocus()
	procSetTimer.Call(frame, 1, 400, 0)
	procSetTimer.Call(frame, 3, 80, 0)
	s.dockToParent()
	// The caller only needs to know that the native surface is ready. Previously
	// this signal was delayed by a fixed two-second timeout, leaving both React
	// and GDI controls visible during the first fullscreen transition.
	ready <- nil

	go func() {
		time.Sleep(80 * time.Millisecond)
		_ = eng.Play(url, video)
	}()

	var m msg
	for {
		r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
	}
	if onClosedFn != nil {
		onClosedFn()
	}
	return nil
}
