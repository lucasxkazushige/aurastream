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

	wmDestroy    = 0x0002
	wmSize       = 0x0005
	wmPaint      = 0x000F
	wmClose      = 0x0010
	wmQuit       = 0x0012
	wmEraseBkg   = 0x0014
	wmKeyDown    = 0x0100
	wmTimer      = 0x0113
	wmMouseMove  = 0x0200
	wmLButtonDown = 0x0201
	wmLButtonUp  = 0x0202
	wmLButtonDbl = 0x0203
	wmMouseLeave = 0x02A3
	wmMouseWheel = 0x020A
	wmSetCursor  = 0x0020
	wmKillFocus  = 0x0008

	swShow = 5
	swHide = 0
	idcArrow = 32512
	idcHand  = 32649
	csHRedraw = 0x0002
	csVRedraw = 0x0001
	blackBrush = 4
	transparent = 1

	dtCenter     = 0x0001
	dtVCenter    = 0x0004
	dtSingleLine = 0x0020
	dtEndEllipsis = 0x8000
	dtLeft       = 0

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

	barTopH = 72
	barBotH = 108
	hitNone = 0
	hitBack = 1
	hitPlay = 2
	hitRew  = 3
	hitFwd  = 4
	hitAudio = 5
	hitSubs  = 6
	hitSeek  = 7
	hitVol   = 8
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
	hdc         uintptr
	erase       int32
	rc          rect
	restore     int32
	incUpdate   int32
	reserved    [32]byte
}

type point struct{ x, y int32 }

var onClosedFn func()

// SetOnClosed is called when the native player window exits.
func SetOnClosed(fn func()) { onClosedFn = fn }

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")
	gdi32    = windows.NewLazySystemDLL("gdi32.dll")

	procCreateWindowExW  = user32.NewProc("CreateWindowExW")
	procRegisterClassExW = user32.NewProc("RegisterClassExW")
	procDefWindowProcW   = user32.NewProc("DefWindowProcW")
	procGetMessageW      = user32.NewProc("GetMessageW")
	procTranslateMessage = user32.NewProc("TranslateMessage")
	procDispatchMessageW = user32.NewProc("DispatchMessageW")
	procShowWindow       = user32.NewProc("ShowWindow")
	procUpdateWindow     = user32.NewProc("UpdateWindow")
	procDestroyWindow    = user32.NewProc("DestroyWindow")
	procGetClientRect    = user32.NewProc("GetClientRect")
	procMoveWindow       = user32.NewProc("MoveWindow")
	procGetModuleHandleW = kernel32.NewProc("GetModuleHandleW")
	procPostQuitMessage  = user32.NewProc("PostQuitMessage")
	procGetStockObject   = gdi32.NewProc("GetStockObject")
	procLoadCursorW      = user32.NewProc("LoadCursorW")
	procSetCursor        = user32.NewProc("SetCursor")
	procSetTimer         = user32.NewProc("SetTimer")
	procKillTimer        = user32.NewProc("KillTimer")
	procSetFocus         = user32.NewProc("SetFocus")
	procInvalidateRect   = user32.NewProc("InvalidateRect")
	procGetSystemMetrics = user32.NewProc("GetSystemMetrics")
	procBeginPaint       = user32.NewProc("BeginPaint")
	procEndPaint         = user32.NewProc("EndPaint")
	procFillRect         = user32.NewProc("FillRect")
	procSetTextColor     = gdi32.NewProc("SetTextColor")
	procSetBkMode        = gdi32.NewProc("SetBkMode")
	procDrawTextW        = user32.NewProc("DrawTextW")
	procSelectObject     = gdi32.NewProc("SelectObject")
	procCreateSolidBrush = gdi32.NewProc("CreateSolidBrush")
	procCreatePen        = gdi32.NewProc("CreatePen")
	procDeleteObject     = gdi32.NewProc("DeleteObject")
	procCreateFontW      = gdi32.NewProc("CreateFontW")
	procEllipse          = gdi32.NewProc("Ellipse")
	procMoveToEx         = gdi32.NewProc("MoveToEx")
	procLineTo           = gdi32.NewProc("LineTo")
	procGetCursorPos     = user32.NewProc("GetCursorPos")
	procScreenToClient   = user32.NewProc("ScreenToClient")
	procSetCapture       = user32.NewProc("SetCapture")
	procReleaseCapture   = user32.NewProc("ReleaseCapture")
	procGetWindowRect    = user32.NewProc("GetWindowRect")
	procSetWindowPos     = user32.NewProc("SetWindowPos")
	procPostMessageW     = user32.NewProc("PostMessageW")

	frameProc = syscall.NewCallback(frameWndProc)
	videoProc = syscall.NewCallback(videoWndProc)
	barProc   = syscall.NewCallback(barWndProc)
	menuProc  = syscall.NewCallback(menuWndProc)

	active *session
)

type session struct {
	engine   *Engine
	frame    uintptr
	video    uintptr
	top      uintptr
	bot      uintptr
	menu     uintptr
	hInst    uintptr
	title    string
	startMs  int64
	seeked   bool
	prefsOn  bool
	volume   int
	muted    bool
	chrome   bool
	dragging bool
	dragVol  bool
	hover    int
	font     uintptr
	fontSm   uintptr
	fontBig  uintptr
	menuKind int // 1 audio 2 subs
	menuItems []Track
	brushes  []uintptr
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
	procMoveWindow.Call(s.top, 0, 0, uintptr(w), uintptr(barTopH), 1)
	procMoveWindow.Call(s.bot, 0, uintptr(h-barBotH), uintptr(w), uintptr(barBotH), 1)
}

func (s *session) showChrome() {
	s.chrome = true
	procShowWindow.Call(s.top, swShow)
	procShowWindow.Call(s.bot, swShow)
	procInvalidateRect.Call(s.top, 0, 1)
	procInvalidateRect.Call(s.bot, 0, 1)
	procKillTimer.Call(s.frame, 2)
	if s.engine.IsPlaying() {
		procSetTimer.Call(s.frame, 2, 2800, 0)
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
}

func hitBottom(x, y, w int32) int {
	if y < 22 {
		return hitSeek
	}
	by := int32(40)
	bh := int32(44)
	if y < by || y > by+bh {
		if x > w-170 && y > 36 && y < 90 {
			return hitVol
		}
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
	case x >= w-270 && x < w-170:
		return hitAudio
	case x >= w-160 && x < w-24:
		return hitSubs
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
	textOut(hdc, s.fontBig, rect{136, 8, w-24, 40}, s.title, rgb(250, 250, 250), dtLeft|dtVCenter|dtSingleLine|dtEndEllipsis)
	textOut(hdc, s.fontSm, rect{136, 38, w-24, 62}, "Arquivo original  ·  motor VLC  ·  A áudio   S legendas   Esc sair", rgb(160, 160, 168), dtLeft|dtVCenter|dtSingleLine)
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
	vx := w - 400
	if vx < 450 {
		vx = 450
	}
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
	drawPill(w-270, w-170, aName, s.hover == hitAudio, false)
	drawPill(w-160, w-24, sName, s.hover == hitSubs, false)
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
	textOut(hdc, s.fontSm, rect{16, 8, w-16, 32}, title, rgb(160, 160, 168), dtLeft|dtVCenter|dtSingleLine)
	off := int32(40)
	if s.menuKind == 2 {
		fill(hdc, rect{8, off, w - 8, off + itemH}, rgb(28, 28, 32))
		label := "Desativadas"
		if s.engine.SpuID() < 0 {
			label = "✓  Desativadas"
		}
		textOut(hdc, s.font, rect{16, off, w-16, off + itemH}, label, rgb(255, 255, 255), dtLeft|dtVCenter|dtSingleLine)
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
		textOut(hdc, s.font, rect{16, off, w-16, off + itemH}, name, rgb(255, 255, 255), dtLeft|dtVCenter|dtSingleLine)
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
	x := rc.right - mw - 24
	if kind == 1 {
		x = rc.right - 270 - mw
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
	procInvalidateRect.Call(s.menu, 0, 1)
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
	vx := w - 400 + 40
	if vx < 490 {
		vx = 490
	}
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
	}
	procInvalidateRect.Call(s.bot, 0, 1)
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
			procInvalidateRect.Call(s.bot, 0, 1)
			return 0
		}
		if s.dragVol && hwnd == s.bot {
			s.volAt(x, w)
			procInvalidateRect.Call(s.bot, 0, 1)
			return 0
		}
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
		procInvalidateRect.Call(hwnd, 0, 0)
		return 0
	case wmLButtonDown:
		s.noteMouse()
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

func videoWndProc(hwnd, msg, wparam, lparam uintptr) uintptr {
	switch msg {
	case wmEraseBkg:
		return 1
	case wmMouseMove:
		if active != nil {
			active.noteMouse()
		}
	case wmLButtonUp:
		if active != nil {
			active.engine.TogglePause()
			active.showChrome()
		}
		return 0
	case wmLButtonDbl:
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
	case wmTimer:
		if s == nil {
			return 0
		}
		if wparam == 2 {
			s.hideChrome()
			return 0
		}
		if s.engine.player != 0 {
			cur, _ := s.engine.Time()
			if !s.seeked && s.startMs > 0 && cur > 400 {
				s.engine.SetTime(s.startMs)
				s.seeked = true
			}
			applyPrefs(s)
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
			procDestroyWindow.Call(hwnd)
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
		style:         csHRedraw | csVRedraw,
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
	hwnd, _, _ := procCreateWindowExW.Call(
		0, uintptr(unsafe.Pointer(utf16(class))), 0, style,
		x, y, w, h, parent, 0, hInst, 0,
	)
	return hwnd
}

// StopActive closes the native player if it is open.
func StopActive() {
	s := active
	if s == nil || s.frame == 0 {
		return
	}
	procPostMessageW.Call(s.frame, wmClose, 0, 0)
}

// Play opens a native fullscreen libVLC window in a dedicated OS thread.
func Play(url, title string, startSeconds float64) error {
	done := make(chan error, 1)
	go func() {
		runtime.LockOSThread()
		done <- run(url, title, startSeconds)
	}()
	select {
	case err := <-done:
		return err
	case <-time.After(2 * time.Second):
		return nil
	}
}

func run(url, title string, startSeconds float64) error {
	dir := FindLibVLCDir()
	if dir == "" {
		return fmt.Errorf("libvlc.dll não encontrado ao lado do AuraStream.exe")
	}
	eng, err := NewEngine(dir)
	if err != nil {
		return err
	}
	hInst, _, _ := procGetModuleHandleW.Call(0)
	brush, _, _ := procGetStockObject.Call(blackBrush)
	registerClass("AuraStreamGoFrame", frameProc, hInst, brush)
	registerClass("AuraStreamGoVideo", videoProc, hInst, brush)
	registerClass("AuraStreamGoBar", barProc, hInst, 0)
	registerClass("AuraStreamGoMenu", menuProc, hInst, 0)

	cx, _, _ := procGetSystemMetrics.Call(0)
	cy, _, _ := procGetSystemMetrics.Call(1)
	style := uintptr(wsPopup | wsVisible | wsClipChildren | wsClipSiblings)
	frame, _, err2 := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(utf16("AuraStreamGoFrame"))),
		uintptr(unsafe.Pointer(utf16(title+" — AuraStream"))),
		style,
		0, 0, cx, cy,
		0, 0, hInst, 0,
	)
	if frame == 0 {
		eng.Close()
		return fmt.Errorf("CreateWindow: %v", err2)
	}

	video := createChild("AuraStreamGoVideo", wsChild|wsVisible|wsClipSiblings, 0, 0, cx, cy, frame, hInst)
	top := createChild("AuraStreamGoBar", wsChild|wsVisible|wsClipSiblings, 0, 0, cx, uintptr(barTopH), frame, hInst)
	bot := createChild("AuraStreamGoBar", wsChild|wsVisible|wsClipSiblings, 0, cy-uintptr(barBotH), cx, uintptr(barBotH), frame, hInst)

	s := &session{
		engine:  eng,
		frame:   frame,
		video:   video,
		top:     top,
		bot:     bot,
		hInst:   hInst,
		title:   title,
		startMs: int64(startSeconds * 1000),
		volume:  90,
		chrome:  true,
		font:    mkFont(15, true),
		fontSm:  mkFont(12, false),
		fontBig: mkFont(18, true),
	}
	active = s
	s.layout()
	procShowWindow.Call(frame, swShow)
	procUpdateWindow.Call(frame)
	procSetFocus.Call(frame)
	procSetTimer.Call(frame, 1, 400, 0)
	s.showChrome()

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
