package ui

import (
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"sync"
	"time"

	"aurastream/desktop/api"
	"aurastream/desktop/player"

	"gioui.org/app"
	"gioui.org/f32"
	"gioui.org/font"
	"gioui.org/font/gofont"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/text"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
)

var (
	bg       = color.NRGBA{R: 10, G: 10, B: 12, A: 255}
	card     = color.NRGBA{R: 22, G: 22, B: 26, A: 255}
	cardHi   = color.NRGBA{R: 36, G: 36, B: 42, A: 255}
	accent   = color.NRGBA{R: 229, G: 9, B: 20, A: 255}
	accent2  = color.NRGBA{R: 185, G: 28, B: 28, A: 255}
	muted    = color.NRGBA{R: 163, G: 163, B: 170, A: 255}
	white    = color.NRGBA{R: 250, G: 250, B: 250, A: 255}
	okGreen  = color.NRGBA{R: 52, G: 211, B: 153, A: 255}
	starGold = color.NRGBA{R: 250, G: 204, B: 21, A: 255}
	chipBg   = color.NRGBA{R: 255, G: 255, B: 255, A: 22}
)

type imgEntry struct {
	op paint.ImageOp
}

type rowData struct {
	Title string
	Items []api.Media
}

type UI struct {
	win    *app.Window
	client *api.Client
	theme  *material.Theme

	search    widget.Editor
	searchBtn widget.Clickable
	tabHome   widget.Clickable
	tabMovies widget.Clickable
	tabTV     widget.Clickable
	playBtn   widget.Clickable
	infoPlay  widget.Clickable
	backBtn   widget.Clickable
	heroPlay  widget.Clickable
	heroInfo  widget.Clickable
	seasonUp  widget.Clickable
	seasonDn  widget.Clickable
	epUp      widget.Clickable
	epDn      widget.Clickable
	srcClicks [12]widget.Clickable

	srcList  widget.List
	homeList widget.List
	rowLists []*widget.List

	page    string
	tab     string
	status  string
	loading bool
	season  int
	episode int

	selected *api.Media
	details  *api.Media
	sources  []api.Stream

	trending []api.Media
	movies   []api.Media
	top      []api.Media
	shows    []api.Media
	action   []api.Media
	comedy   []api.Media
	anim     []api.Media
	scifi    []api.Media
	results  []api.Media

	clicks map[string]*widget.Clickable
	imgs   sync.Map
	mu     sync.Mutex
}

func Run(client *api.Client) {
	go func() {
		w := new(app.Window)
		w.Option(app.Title("AuraStream 4K"))
		w.Option(app.MinSize(unit.Dp(1200), unit.Dp(720)))
		w.Option(app.Size(unit.Dp(1360), unit.Dp(860)))
		u := &UI{
			win:      w,
			client:   client,
			page:     "home",
			tab:      "home",
			season:   1,
			episode:  1,
			clicks:   map[string]*widget.Clickable{},
			homeList: widget.List{List: layout.List{Axis: layout.Vertical}},
			srcList:  widget.List{List: layout.List{Axis: layout.Vertical}},
		}
		u.search.SingleLine = true
		u.search.Submit = true
		th := material.NewTheme()
		th.Shaper = text.NewShaper(text.WithCollection(gofont.Collection()))
		th.Palette.Bg = bg
		th.Palette.Fg = white
		th.Palette.ContrastBg = accent
		th.Palette.ContrastFg = white
		u.theme = th
		go u.reloadHome()
		if err := u.loop(w); err != nil {
			panic(err)
		}
	}()
	app.Main()
}

func (u *UI) loop(w *app.Window) error {
	var ops op.Ops
	for {
		switch e := w.Event().(type) {
		case app.DestroyEvent:
			return e.Err
		case app.FrameEvent:
			gtx := app.NewContext(&ops, e)
			u.update(gtx)
			u.layout(gtx)
			if u.tab == "home" && u.page == "home" {
				gtx.Execute(op.InvalidateCmd{At: gtx.Now.Add(time.Second)})
			}
			e.Frame(gtx.Ops)
		}
	}
}

func (u *UI) invalidate() {
	if u.win != nil {
		u.win.Invalidate()
	}
}

func (u *UI) clk(id string) *widget.Clickable {
	if c, ok := u.clicks[id]; ok {
		return c
	}
	c := &widget.Clickable{}
	u.clicks[id] = c
	return c
}

func (u *UI) hlist(i int) *widget.List {
	for len(u.rowLists) <= i {
		u.rowLists = append(u.rowLists, &widget.List{List: layout.List{Axis: layout.Horizontal}})
	}
	return u.rowLists[i]
}

func (u *UI) reloadHome() {
	u.setStatus("Carregando catálogo…")
	type job struct {
		dst  *[]api.Media
		load func() ([]api.Media, error)
	}
	jobs := []job{
		{&u.trending, func() ([]api.Media, error) { return u.client.Trending("all") }},
		{&u.movies, func() ([]api.Media, error) { return u.client.Popular("movie") }},
		{&u.top, func() ([]api.Media, error) { return u.client.TopRated("movie") }},
		{&u.shows, func() ([]api.Media, error) { return u.client.Popular("tv") }},
		{&u.action, func() ([]api.Media, error) { return u.client.Genre("movie", 28) }},
		{&u.comedy, func() ([]api.Media, error) { return u.client.Genre("movie", 35) }},
		{&u.anim, func() ([]api.Media, error) { return u.client.Genre("movie", 16) }},
		{&u.scifi, func() ([]api.Media, error) { return u.client.Genre("movie", 878) }},
	}
	var wg sync.WaitGroup
	for i := range jobs {
		wg.Add(1)
		go func(j job) {
			defer wg.Done()
			list, err := j.load()
			if err != nil {
				return
			}
			u.mu.Lock()
			*j.dst = list
			u.mu.Unlock()
			for _, m := range list {
				u.prefetch(m.Poster())
				u.prefetch(m.Backdrop())
			}
			u.invalidate()
		}(jobs[i])
	}
	wg.Wait()
	u.setStatus("")
	u.invalidate()
}

func (u *UI) setStatus(s string) {
	u.mu.Lock()
	u.status = s
	u.mu.Unlock()
	u.invalidate()
}

func (u *UI) prefetch(url string) {
	if url == "" {
		return
	}
	if _, ok := u.imgs.Load(url); ok {
		return
	}
	u.imgs.Store(url, struct{}{}) // placeholder to avoid duplicate fetches
	go func() {
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("User-Agent", "AuraStream/1.0")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			u.imgs.Delete(url)
			return
		}
		defer resp.Body.Close()
		img, _, err := image.Decode(io.LimitReader(resp.Body, 8<<20))
		if err != nil {
			u.imgs.Delete(url)
			return
		}
		u.imgs.Store(url, imgEntry{op: paint.NewImageOp(img)})
		u.invalidate()
	}()
}

func (u *UI) update(gtx layout.Context) {
	if u.searchBtn.Clicked(gtx) || submitted(&u.search, gtx) {
		q := u.search.Text()
		if q != "" {
			go u.doSearch(q)
		}
	}
	if u.tabHome.Clicked(gtx) {
		u.tab, u.page, u.results = "home", "home", nil
	}
	if u.tabMovies.Clicked(gtx) {
		u.tab, u.page = "movies", "home"
	}
	if u.tabTV.Clicked(gtx) {
		u.tab, u.page = "tv", "home"
	}
	if u.backBtn.Clicked(gtx) {
		u.page = "home"
		u.selected, u.details, u.sources = nil, nil, nil
	}
	if (u.playBtn.Clicked(gtx) || u.infoPlay.Clicked(gtx)) && u.selected != nil && !u.loading {
		go u.startPlay(nil)
	}
	if u.heroInfo.Clicked(gtx) {
		if m := u.heroItem(); m != nil {
			u.openDetails(*m)
		}
	}
	if u.heroPlay.Clicked(gtx) && !u.loading {
		if m := u.heroItem(); m != nil {
			u.openDetails(*m)
			go u.startPlay(nil)
		}
	}
	if u.seasonUp.Clicked(gtx) {
		u.season++
	}
	if u.seasonDn.Clicked(gtx) && u.season > 1 {
		u.season--
	}
	if u.epUp.Clicked(gtx) {
		u.episode++
	}
	if u.epDn.Clicked(gtx) && u.episode > 1 {
		u.episode--
	}
	for i := range u.srcClicks {
		if i < len(u.sources) && u.srcClicks[i].Clicked(gtx) && !u.loading {
			s := u.sources[i]
			go u.startPlay(&s)
		}
	}

	u.mu.Lock()
	lists := [][]api.Media{u.trending, u.movies, u.top, u.shows, u.action, u.comedy, u.anim, u.scifi, u.results}
	u.mu.Unlock()
	for _, list := range lists {
		for i := range list {
			key := fmt.Sprintf("%s-%d", list[i].MediaType, list[i].ID)
			if u.clk(key).Clicked(gtx) {
				u.openDetails(list[i])
			}
		}
	}
}

func submitted(e *widget.Editor, gtx layout.Context) bool {
	for {
		ev, ok := e.Update(gtx)
		if !ok {
			return false
		}
		if _, ok := ev.(widget.SubmitEvent); ok {
			return true
		}
	}
}

func (u *UI) heroItem() *api.Media {
	u.mu.Lock()
	defer u.mu.Unlock()
	if len(u.trending) == 0 {
		return nil
	}
	n := 5
	if len(u.trending) < n {
		n = len(u.trending)
	}
	idx := int(time.Now().Unix()/8) % n
	m := u.trending[idx]
	return &m
}

func (u *UI) doSearch(q string) {
	u.setStatus("Buscando “" + q + "”…")
	res, err := u.client.Search(q)
	if err != nil {
		u.setStatus(err.Error())
		return
	}
	u.mu.Lock()
	u.results = res
	u.tab = "search"
	u.page = "home"
	u.mu.Unlock()
	u.setStatus(fmt.Sprintf("%d títulos encontrados", len(res)))
	for _, m := range res {
		u.prefetch(m.Poster())
	}
	u.invalidate()
}

func (u *UI) openDetails(m api.Media) {
	u.page = "details"
	cp := m
	u.selected = &cp
	u.details = &cp
	u.sources = nil
	u.season, u.episode = 1, 1
	u.prefetch(m.Backdrop())
	u.prefetch(m.Poster())
	go func() {
		var d api.Media
		var err error
		if m.MediaType == "tv" {
			d, err = u.client.TV(m.ID)
		} else {
			d, err = u.client.Movie(m.ID)
		}
		if err == nil {
			u.mu.Lock()
			u.details = &d
			u.selected = &d
			u.mu.Unlock()
			u.prefetch(d.Backdrop())
			u.prefetch(d.Poster())
			u.invalidate()
		}
	}()
}

func (u *UI) startPlay(forced *api.Stream) {
	u.mu.Lock()
	sel := u.selected
	season, episode := u.season, u.episode
	u.loading = true
	u.mu.Unlock()
	u.invalidate()
	if sel == nil {
		return
	}
	kind := sel.MediaType
	if kind == "" {
		kind = "movie"
	}
	title := sel.DisplayTitle()
	var best *api.Stream
	if forced != nil {
		best = forced
	} else {
		u.setStatus("Procurando a melhor fonte…")
		streams, err := u.client.Sources(sel.ImdbID, kind, title, sel.Year(), season, episode)
		if err != nil {
			u.fail(err.Error())
			return
		}
		u.mu.Lock()
		u.sources = streams
		u.mu.Unlock()
		best = api.PickBest(streams)
	}
	if best == nil {
		u.fail("Nenhuma fonte disponível para este título.")
		return
	}
	epInfo := ""
	if kind == "tv" {
		epInfo = fmt.Sprintf(" S%02dE%02d", season, episode)
	}
	u.setStatus("Conectando ao enxame · " + best.Resolution + " · " + best.Size)
	sess, err := u.client.StartStream(best.Magnet, fmt.Sprintf("%d", sel.ID), kind, title+epInfo)
	if err != nil {
		u.fail(err.Error())
		return
	}
	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		st, err := u.client.Status(sess.InfoHash)
		if err == nil {
			sess = st
			u.setStatus(fmt.Sprintf("Preparando reprodução · %d%% · %d seeds", st.Progress, st.Seeds))
			if st.Status == "ready" || st.Status == "completed" || st.Status == "transcoding" {
				break
			}
			if st.Status == "error" {
				u.fail(st.Error)
				return
			}
		}
		time.Sleep(800 * time.Millisecond)
	}
	url := u.client.DirectURL(sess)
	u.setStatus("Iniciando player nativo…")
	if err := player.Play(url, title+epInfo, 0); err != nil {
		u.fail(err.Error())
		return
	}
	u.mu.Lock()
	u.loading = false
	u.status = ""
	u.mu.Unlock()
	u.invalidate()
}

func (u *UI) fail(msg string) {
	u.mu.Lock()
	u.loading = false
	u.status = msg
	u.mu.Unlock()
	u.invalidate()
}

func (u *UI) layout(gtx layout.Context) layout.Dimensions {
	paint.Fill(gtx.Ops, bg)
	dims := layout.Stack{Alignment: layout.NW}.Layout(gtx,
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
				layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
					if u.page == "details" && u.selected != nil {
						return u.detailsPage(gtx)
					}
					return u.homePage(gtx)
				}),
			)
		}),
		layout.Stacked(func(gtx layout.Context) layout.Dimensions {
			return u.navbar(gtx)
		}),
		layout.Expanded(func(gtx layout.Context) layout.Dimensions {
			if !u.loading {
				return layout.Dimensions{Size: gtx.Constraints.Min}
			}
			return u.loadingOverlay(gtx)
		}),
	)
	return dims
}

func (u *UI) navbar(gtx layout.Context) layout.Dimensions {
	h := gtx.Dp(64)
	gtx.Constraints.Min.Y = h
	gtx.Constraints.Max.Y = h
	// translucent bar
	defer clip.Rect{Max: image.Pt(gtx.Constraints.Max.X, h)}.Push(gtx.Ops).Pop()
	paint.Fill(gtx.Ops, color.NRGBA{R: 8, G: 8, B: 10, A: 210})
	return layout.Inset{Left: 28, Right: 24}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Flex{Alignment: layout.Middle}.Layout(gtx,
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				lbl := material.H6(u.theme, "AURASTREAM")
				lbl.Color = accent
				lbl.Font.Weight = font.Bold
				return lbl.Layout(gtx)
			}),
			layout.Rigid(layout.Spacer{Width: 28}.Layout),
			layout.Rigid(u.navLink(&u.tabHome, "Início", u.tab == "home")),
			layout.Rigid(layout.Spacer{Width: 6}.Layout),
			layout.Rigid(u.navLink(&u.tabMovies, "Filmes", u.tab == "movies")),
			layout.Rigid(layout.Spacer{Width: 6}.Layout),
			layout.Rigid(u.navLink(&u.tabTV, "Séries", u.tab == "tv")),
			layout.Rigid(layout.Spacer{Width: 20}.Layout),
			layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
				return widget.Border{
					Color:        color.NRGBA{R: 255, G: 255, B: 255, A: 28},
					CornerRadius: 22,
					Width:        1,
				}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					return layout.Inset{Top: 8, Bottom: 8, Left: 16, Right: 12}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
						ed := material.Editor(u.theme, &u.search, "Buscar títulos, gêneros, atores…")
						ed.HintColor = muted
						ed.Color = white
						return ed.Layout(gtx)
					})
				})
			}),
			layout.Rigid(layout.Spacer{Width: 10}.Layout),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				b := material.Button(u.theme, &u.searchBtn, "Buscar")
				b.Background = accent
				b.CornerRadius = 18
				b.Inset = layout.Inset{Top: 8, Bottom: 8, Left: 16, Right: 16}
				return b.Layout(gtx)
			}),
		)
	})
}

func (u *UI) navLink(c *widget.Clickable, label string, on bool) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		col := muted
		if on {
			col = white
		}
		return c.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			lbl := material.Body1(u.theme, label)
			lbl.Color = col
			if on {
				lbl.Font.Weight = font.Bold
			}
			d := layout.Inset{Top: 8, Bottom: 8, Left: 10, Right: 10}.Layout(gtx, lbl.Layout)
			if on {
				bar := clip.Rect{Min: image.Pt(10, d.Size.Y-3), Max: image.Pt(d.Size.X-10, d.Size.Y)}.Op()
				paint.FillShape(gtx.Ops, accent, bar)
			}
			return d
		})
	}
}

func (u *UI) homePage(gtx layout.Context) layout.Dimensions {
	u.mu.Lock()
	rows := u.rowsLocked()
	u.mu.Unlock()

	n := len(rows)
	extra := 0
	if u.tab == "home" && u.page == "home" {
		extra = 1
	}
	return layout.Inset{Top: 64}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return material.List(u.theme, &u.homeList).Layout(gtx, n+extra, func(gtx layout.Context, i int) layout.Dimensions {
			if extra == 1 && i == 0 {
				return u.hero(gtx)
			}
			ri := i - extra
			if ri < 0 || ri >= len(rows) {
				return layout.Dimensions{}
			}
			return u.mediaRow(gtx, rows[ri], ri)
		})
	})
}

func (u *UI) rowsLocked() []rowData {
	switch u.tab {
	case "search":
		return []rowData{{"Resultados da busca", u.results}}
	case "movies":
		return []rowData{
			{"Populares", u.movies},
			{"Mais bem avaliados", u.top},
			{"Ação e aventura", u.action},
			{"Comédia", u.comedy},
			{"Animação", u.anim},
			{"Ficção científica", u.scifi},
		}
	case "tv":
		return []rowData{{"Séries em alta", u.shows}}
	default:
		return []rowData{
			{"Em alta esta semana", u.trending},
			{"Filmes populares", u.movies},
			{"Séries para maratonar", u.shows},
			{"Mais bem avaliados", u.top},
			{"Ação", u.action},
			{"Comédia", u.comedy},
			{"Animação", u.anim},
			{"Ficção científica", u.scifi},
		}
	}
}

func (u *UI) hero(gtx layout.Context) layout.Dimensions {
	item := u.heroItem()
	h := gtx.Dp(430)
	max := gtx.Constraints.Max
	sz := image.Pt(max.X, h)
	defer clip.Rect{Max: sz}.Push(gtx.Ops).Pop()
	paint.Fill(gtx.Ops, color.NRGBA{R: 16, G: 16, B: 18, A: 255})
	if item != nil {
		u.drawCover(gtx, item.Backdrop(), sz)
	}
	// cinematic gradients
	paint.LinearGradientOp{
		Stop1:  f32.Pt(0, 0),
		Stop2:  f32.Pt(0, float32(h)),
		Color1: color.NRGBA{A: 40},
		Color2: bg,
	}.Add(gtx.Ops)
	paint.PaintOp{}.Add(gtx.Ops)
	paint.LinearGradientOp{
		Stop1:  f32.Pt(0, 0),
		Stop2:  f32.Pt(float32(max.X)*0.72, 0),
		Color1: color.NRGBA{R: 8, G: 8, B: 10, A: 210},
		Color2: color.NRGBA{A: 0},
	}.Add(gtx.Ops)
	paint.PaintOp{}.Add(gtx.Ops)

	if item == nil {
		return layout.Dimensions{Size: sz}
	}
	return layout.Inset{Top: 110, Left: 48, Right: 48, Bottom: 36}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		gtx.Constraints.Max.Y = h - gtx.Dp(110)
		return layout.Flex{Axis: layout.Vertical, Spacing: layout.SpaceEnd}.Layout(gtx,
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				chip := material.Caption(u.theme, "EM DESTAQUE  ·  "+item.KindLabel())
				chip.Color = accent
				chip.Font.Weight = font.Bold
				return chip.Layout(gtx)
			}),
			layout.Rigid(layout.Spacer{Height: 8}.Layout),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				t := material.H3(u.theme, item.DisplayTitle())
				t.Color = white
				t.Font.Weight = font.Bold
				t.MaxLines = 2
				return t.Layout(gtx)
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				meta := item.Year()
				if item.VoteAverage > 0 {
					meta += fmt.Sprintf("   ★  %.1f", item.VoteAverage)
				}
				l := material.Body2(u.theme, meta)
				l.Color = starGold
				return layout.Inset{Top: 8, Bottom: 10}.Layout(gtx, l.Layout)
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				gtx.Constraints.Max.X = gtx.Dp(560)
				l := material.Body1(u.theme, api.Truncate(item.Overview, 220))
				l.Color = color.NRGBA{R: 228, G: 228, B: 231, A: 255}
				l.MaxLines = 3
				return l.Layout(gtx)
			}),
			layout.Rigid(layout.Spacer{Height: 18}.Layout),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{}.Layout(gtx,
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						b := material.Button(u.theme, &u.heroPlay, "▶   Assistir")
						b.Background = white
						b.Color = color.NRGBA{R: 20, G: 20, B: 20, A: 255}
						b.CornerRadius = 8
						b.Inset = layout.Inset{Top: 12, Bottom: 12, Left: 22, Right: 22}
						return b.Layout(gtx)
					}),
					layout.Rigid(layout.Spacer{Width: 12}.Layout),
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						b := material.Button(u.theme, &u.heroInfo, "ℹ   Mais informações")
						b.Background = color.NRGBA{R: 255, G: 255, B: 255, A: 36}
						b.Color = white
						b.CornerRadius = 8
						b.Inset = layout.Inset{Top: 12, Bottom: 12, Left: 22, Right: 22}
						return b.Layout(gtx)
					}),
				)
			}),
		)
	})
}

func (u *UI) mediaRow(gtx layout.Context, row rowData, idx int) layout.Dimensions {
	if len(row.Items) == 0 {
		return layout.Dimensions{}
	}
	return layout.Inset{Left: 36, Right: 24, Top: 6, Bottom: 22}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				t := material.H6(u.theme, row.Title)
				t.Color = white
				t.Font.Weight = font.Bold
				return layout.Inset{Bottom: 12}.Layout(gtx, t.Layout)
			}),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				gtx.Constraints.Min.Y = gtx.Dp(268)
				gtx.Constraints.Max.Y = gtx.Dp(268)
				lst := u.hlist(idx)
				return lst.Layout(gtx, len(row.Items), func(gtx layout.Context, j int) layout.Dimensions {
					if j >= len(row.Items) {
						return layout.Dimensions{}
					}
					return u.posterCard(gtx, row.Items[j])
				})
			}),
		)
	})
}

func (u *UI) posterCard(gtx layout.Context, m api.Media) layout.Dimensions {
	key := fmt.Sprintf("%s-%d", m.MediaType, m.ID)
	clk := u.clk(key)
	w, h := gtx.Dp(148), gtx.Dp(252)
	hovered := clk.Hovered()
	return layout.Inset{Right: 12}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return clk.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			sz := image.Pt(w, h)
			gtx.Constraints.Min = sz
			gtx.Constraints.Max = sz
			r := gtx.Dp(10)
			defer clip.UniformRRect(image.Rectangle{Max: sz}, r).Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, card)
			posterH := gtx.Dp(210)
			{
				cgtx := gtx
				cgtx.Constraints.Min = image.Pt(w, posterH)
				cgtx.Constraints.Max = image.Pt(w, posterH)
				stack := op.Offset(image.Point{}).Push(gtx.Ops)
				u.drawCover(cgtx, m.Poster(), image.Pt(w, posterH))
				stack.Pop()
			}
			// bottom gradient + title
			paint.LinearGradientOp{
				Stop1:  f32.Pt(0, float32(posterH-40)),
				Stop2:  f32.Pt(0, float32(h)),
				Color1: color.NRGBA{A: 0},
				Color2: color.NRGBA{R: 8, G: 8, B: 10, A: 240},
			}.Add(gtx.Ops)
			paint.PaintOp{}.Add(gtx.Ops)

			// type chip
			layout.Inset{Top: 8, Left: 8}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				lbl := material.Caption(u.theme, m.KindLabel())
				lbl.Color = white
				lbl.Font.Weight = font.Bold
				return layout.Background{}.Layout(gtx,
					func(gtx layout.Context) layout.Dimensions {
						defer clip.UniformRRect(image.Rectangle{Max: gtx.Constraints.Min}, 4).Push(gtx.Ops).Pop()
						paint.Fill(gtx.Ops, accent)
						return layout.Inset{Top: 2, Bottom: 2, Left: 6, Right: 6}.Layout(gtx, lbl.Layout)
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Top: 2, Bottom: 2, Left: 6, Right: 6}.Layout(gtx, lbl.Layout)
					},
				)
			})

			layout.Inset{Top: 216, Left: 8, Right: 8}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				t := material.Caption(u.theme, m.DisplayTitle())
				t.Color = white
				t.MaxLines = 1
				t.Font.Weight = font.Medium
				return t.Layout(gtx)
			})
			if hovered {
				paint.Fill(gtx.Ops, color.NRGBA{R: 255, G: 255, B: 255, A: 18})
			}
			return layout.Dimensions{Size: sz}
		})
	})
}

func (u *UI) detailsPage(gtx layout.Context) layout.Dimensions {
	m := u.details
	if m == nil {
		m = u.selected
	}
	u.mu.Lock()
	loading := u.loading
	sources := append([]api.Stream(nil), u.sources...)
	u.mu.Unlock()

	return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			h := gtx.Dp(340)
			sz := image.Pt(gtx.Constraints.Max.X, h)
			defer clip.Rect{Max: sz}.Push(gtx.Ops).Pop()
			u.drawCover(gtx, m.Backdrop(), sz)
			paint.LinearGradientOp{
				Stop1:  f32.Pt(0, float32(h)*0.3),
				Stop2:  f32.Pt(0, float32(h)),
				Color1: color.NRGBA{A: 0},
				Color2: bg,
			}.Add(gtx.Ops)
			paint.PaintOp{}.Add(gtx.Ops)
			paint.LinearGradientOp{
				Stop1:  f32.Pt(0, 0),
				Stop2:  f32.Pt(float32(sz.X)*0.65, 0),
				Color1: color.NRGBA{R: 8, G: 8, B: 10, A: 180},
				Color2: color.NRGBA{A: 0},
			}.Add(gtx.Ops)
			paint.PaintOp{}.Add(gtx.Ops)
			layout.Inset{Top: 80, Left: 40, Right: 40}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				b := material.Button(u.theme, &u.backBtn, "←  Voltar ao catálogo")
				b.Background = color.NRGBA{R: 0, G: 0, B: 0, A: 140}
				b.Color = white
				b.CornerRadius = 10
				return b.Layout(gtx)
			})
			return layout.Dimensions{Size: sz}
		}),
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Left: 40, Right: 40, Top: 8, Bottom: 16}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Alignment: layout.Start}.Layout(gtx,
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						pw, ph := gtx.Dp(180), gtx.Dp(270)
						sz := image.Pt(pw, ph)
						gtx.Constraints.Min, gtx.Constraints.Max = sz, sz
						defer clip.UniformRRect(image.Rectangle{Max: sz}, 12).Push(gtx.Ops).Pop()
						paint.Fill(gtx.Ops, card)
						u.drawCover(gtx, m.Poster(), sz)
						return layout.Dimensions{Size: sz}
					}),
					layout.Rigid(layout.Spacer{Width: 28}.Layout),
					layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
						return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								t := material.H4(u.theme, m.DisplayTitle())
								t.Color = white
								t.Font.Weight = font.Bold
								t.MaxLines = 2
								return t.Layout(gtx)
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								return layout.Inset{Top: 10, Bottom: 12}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
									return layout.Flex{}.Layout(gtx,
										layout.Rigid(u.chip(m.KindLabel(), accent)),
										layout.Rigid(layout.Spacer{Width: 8}.Layout),
										layout.Rigid(u.chip(m.Year(), chipBg)),
										layout.Rigid(layout.Spacer{Width: 8}.Layout),
										layout.Rigid(u.chip(fmt.Sprintf("★ %.1f", m.VoteAverage), chipBg)),
									)
								})
							}),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								l := material.Body1(u.theme, api.Truncate(m.Overview, 420))
								l.Color = color.NRGBA{R: 212, G: 212, B: 216, A: 255}
								return l.Layout(gtx)
							}),
							layout.Rigid(layout.Spacer{Height: 16}.Layout),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								if m.MediaType != "tv" {
									return layout.Dimensions{}
								}
								return layout.Flex{Alignment: layout.Middle}.Layout(gtx,
									layout.Rigid(u.smallBtn(&u.seasonDn, "−")),
									layout.Rigid(func(gtx layout.Context) layout.Dimensions {
										l := material.Body1(u.theme, fmt.Sprintf("  Temporada %d  ", u.season))
										l.Color = white
										return l.Layout(gtx)
									}),
									layout.Rigid(u.smallBtn(&u.seasonUp, "+")),
									layout.Rigid(layout.Spacer{Width: 18}.Layout),
									layout.Rigid(u.smallBtn(&u.epDn, "−")),
									layout.Rigid(func(gtx layout.Context) layout.Dimensions {
										l := material.Body1(u.theme, fmt.Sprintf("  Episódio %d  ", u.episode))
										l.Color = white
										return l.Layout(gtx)
									}),
									layout.Rigid(u.smallBtn(&u.epUp, "+")),
								)
							}),
							layout.Rigid(layout.Spacer{Height: 14}.Layout),
							layout.Rigid(func(gtx layout.Context) layout.Dimensions {
								label := "▶    Assistir agora"
								if loading {
									label = "Preparando reprodução…"
								}
								b := material.Button(u.theme, &u.playBtn, label)
								b.Background = accent
								b.CornerRadius = 10
								b.Inset = layout.Inset{Top: 14, Bottom: 14, Left: 26, Right: 26}
								b.TextSize = 16
								gtx.Constraints.Min.X = gtx.Dp(240)
								return b.Layout(gtx)
							}),
							layout.Rigid(layout.Spacer{Height: 18}.Layout),
							layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
								if len(sources) == 0 {
									l := material.Caption(u.theme, "Clique em Assistir para localizar as melhores fontes 4K / 1080p.")
									l.Color = muted
									return l.Layout(gtx)
								}
								return material.List(u.theme, &u.srcList).Layout(gtx, len(sources), func(gtx layout.Context, i int) layout.Dimensions {
									return u.sourceCard(gtx, sources[i], i)
								})
							}),
						)
					}),
				)
			})
		}),
	)
}

func (u *UI) sourceCard(gtx layout.Context, s api.Stream, i int) layout.Dimensions {
	if i >= len(u.srcClicks) {
		l := material.Caption(u.theme, s.Title)
		l.Color = muted
		return layout.Inset{Bottom: 8}.Layout(gtx, l.Layout)
	}
	return layout.Inset{Bottom: 8}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return u.srcClicks[i].Layout(gtx, func(gtx layout.Context) layout.Dimensions {
			return widget.Border{Color: color.NRGBA{R: 255, G: 255, B: 255, A: 18}, CornerRadius: 10, Width: 1}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Background{}.Layout(gtx,
					func(gtx layout.Context) layout.Dimensions {
						defer clip.UniformRRect(image.Rectangle{Max: gtx.Constraints.Min}, 10).Push(gtx.Ops).Pop()
						col := card
						if u.srcClicks[i].Hovered() {
							col = cardHi
						}
						paint.Fill(gtx.Ops, col)
						return layout.Dimensions{Size: gtx.Constraints.Min}
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.UniformInset(12).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							badge := s.Resolution
							if s.IsDubbed {
								badge = "DUB  ·  " + badge
							} else if s.HasPtBr {
								badge = "LEG  ·  " + badge
							}
							line := fmt.Sprintf("%s    %s    %d seeds    %s", badge, s.Size, s.Seeds, s.AudioLanguage)
							l := material.Body2(u.theme, line)
							l.Color = white
							return l.Layout(gtx)
						})
					},
				)
			})
		})
	})
}

func (u *UI) chip(txt string, bgc color.NRGBA) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		lbl := material.Caption(u.theme, txt)
		lbl.Color = white
		lbl.Font.Weight = font.Bold
		return layout.Background{}.Layout(gtx,
			func(gtx layout.Context) layout.Dimensions {
				defer clip.UniformRRect(image.Rectangle{Max: gtx.Constraints.Min}, 6).Push(gtx.Ops).Pop()
				paint.Fill(gtx.Ops, bgc)
				return layout.Dimensions{Size: gtx.Constraints.Min}
			},
			func(gtx layout.Context) layout.Dimensions {
				return layout.Inset{Top: 4, Bottom: 4, Left: 8, Right: 8}.Layout(gtx, lbl.Layout)
			},
		)
	}
}

func (u *UI) smallBtn(c *widget.Clickable, label string) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		b := material.Button(u.theme, c, label)
		b.Background = cardHi
		b.CornerRadius = 8
		b.Inset = layout.Inset{Top: 6, Bottom: 6, Left: 12, Right: 12}
		return b.Layout(gtx)
	}
}

func (u *UI) loadingOverlay(gtx layout.Context) layout.Dimensions {
	u.mu.Lock()
	st := u.status
	u.mu.Unlock()
	if st == "" {
		st = "Preparando sua sessão…"
	}
	defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()
	paint.Fill(gtx.Ops, color.NRGBA{R: 0, G: 0, B: 0, A: 180})
	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		gtx.Constraints.Max.X = gtx.Dp(460)
		return layout.Background{}.Layout(gtx,
			func(gtx layout.Context) layout.Dimensions {
				defer clip.UniformRRect(image.Rectangle{Max: gtx.Constraints.Min}, 16).Push(gtx.Ops).Pop()
				paint.Fill(gtx.Ops, color.NRGBA{R: 18, G: 18, B: 22, A: 255})
				return layout.Dimensions{Size: gtx.Constraints.Min}
			},
			func(gtx layout.Context) layout.Dimensions {
				return layout.UniformInset(28).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					return layout.Flex{Axis: layout.Vertical, Alignment: layout.Middle}.Layout(gtx,
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							t := material.H6(u.theme, "Preparando o stream")
							t.Color = white
							t.Font.Weight = font.Bold
							return t.Layout(gtx)
						}),
						layout.Rigid(layout.Spacer{Height: 10}.Layout),
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							l := material.Body2(u.theme, st)
							l.Color = okGreen
							l.Alignment = text.Middle
							return l.Layout(gtx)
						}),
					)
				})
			},
		)
	})
}

func (u *UI) drawCover(gtx layout.Context, url string, sz image.Point) {
	if url == "" {
		paint.Fill(gtx.Ops, card)
		return
	}
	v, ok := u.imgs.Load(url)
	ent, ok2 := v.(imgEntry)
	if !ok || !ok2 {
		paint.Fill(gtx.Ops, card)
		return
	}
	gtx.Constraints.Min = sz
	gtx.Constraints.Max = sz
	widget.Image{Src: ent.op, Fit: widget.Cover, Position: layout.Center}.Layout(gtx)
}
