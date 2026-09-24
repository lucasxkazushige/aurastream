package api

type Media struct {
	ID           int      `json:"id"`
	Title        string   `json:"title"`
	Name         string   `json:"name"`
	Overview     string   `json:"overview"`
	PosterPath   *string  `json:"posterPath"`
	BackdropPath *string  `json:"backdropPath"`
	ReleaseDate  string   `json:"releaseDate"`
	FirstAirDate string   `json:"firstAirDate"`
	VoteAverage  float64  `json:"voteAverage"`
	MediaType    string   `json:"mediaType"`
	ImdbID       string   `json:"imdbId"`
	Runtime      int      `json:"runtime"`
	SeasonsCount int      `json:"seasonsCount"`
	Seasons      []Season `json:"seasons"`
}

func (m Media) DisplayTitle() string {
	if m.Title != "" {
		return m.Title
	}
	return m.Name
}

func (m Media) Year() string {
	d := m.ReleaseDate
	if d == "" {
		d = m.FirstAirDate
	}
	if len(d) >= 4 {
		return d[:4]
	}
	return ""
}

func (m Media) Poster() string {
	if m.PosterPath != nil {
		return *m.PosterPath
	}
	return ""
}

func (m Media) Backdrop() string {
	if m.BackdropPath != nil {
		return *m.BackdropPath
	}
	return m.Poster()
}

func (m Media) KindLabel() string {
	if m.MediaType == "tv" {
		return "SÉRIE"
	}
	return "FILME"
}

func Truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

type Season struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	SeasonNumber int    `json:"seasonNumber"`
	EpisodeCount int    `json:"episodeCount"`
}

type Episode struct {
	ID            int     `json:"id"`
	EpisodeNumber int     `json:"episodeNumber"`
	Name          string  `json:"name"`
	Overview      string  `json:"overview"`
	StillPath     *string `json:"stillPath"`
}

type PageResult struct {
	Page         int     `json:"page"`
	TotalPages   int     `json:"totalPages"`
	TotalResults int     `json:"totalResults"`
	Results      []Media `json:"results"`
}

type Stream struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Resolution    string `json:"resolution"`
	Quality       string `json:"quality"`
	Size          string `json:"size"`
	Seeds         int    `json:"seeds"`
	Magnet        string `json:"magnet"`
	InfoHash      string `json:"infoHash"`
	Source        string `json:"source"`
	HasPtBr       bool   `json:"hasPtBr"`
	IsDubbed      bool   `json:"isDubbed"`
	AudioLanguage string `json:"audioLanguage"`
}

type SourcesResponse struct {
	Count   int      `json:"count"`
	Streams []Stream `json:"streams"`
}

type Session struct {
	InfoHash        string `json:"infoHash"`
	Magnet          string `json:"magnet"`
	Title           string `json:"title"`
	Status          string `json:"status"`
	Progress        int    `json:"progress"`
	DownloadSpeed   int64  `json:"downloadSpeed"`
	Seeds           int    `json:"seeds"`
	DirectStreamURL string `json:"directStreamUrl"`
	Error           string `json:"error"`
}

type SeasonDetails struct {
	Episodes []Episode `json:"episodes"`
}
