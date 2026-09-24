package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	Base   string
	HTTP   *http.Client
}

func New(base string) *Client {
	return &Client{
		Base: strings.TrimRight(base, "/"),
		HTTP: &http.Client{Timeout: 45 * time.Second},
	}
}

func (c *Client) get(path string, out any) error {
	resp, err := c.HTTP.Get(c.Base + path)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.Unmarshal(body, out)
}

func (c *Client) Trending(kind string) ([]Media, error) {
	var out []Media
	if err := c.get("/api/tmdb/trending?type="+url.QueryEscape(kind)+"&timeWindow=week&page=1", &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) Popular(kind string) ([]Media, error) {
	var page PageResult
	if err := c.get("/api/tmdb/popular?type="+url.QueryEscape(kind)+"&page=1", &page); err != nil {
		return nil, err
	}
	return page.Results, nil
}

func (c *Client) TopRated(kind string) ([]Media, error) {
	var page PageResult
	if err := c.get("/api/tmdb/top-rated?type="+url.QueryEscape(kind)+"&page=1", &page); err != nil {
		return nil, err
	}
	return page.Results, nil
}

func (c *Client) Genre(kind string, genreID int) ([]Media, error) {
	var page PageResult
	if err := c.get(fmt.Sprintf("/api/tmdb/genre/%s/%d?page=1", url.PathEscape(kind), genreID), &page); err != nil {
		return nil, err
	}
	return page.Results, nil
}

func (c *Client) Search(q string) ([]Media, error) {
	var page PageResult
	if err := c.get("/api/tmdb/search?q="+url.QueryEscape(q)+"&page=1", &page); err != nil {
		return nil, err
	}
	return page.Results, nil
}

func (c *Client) Movie(id int) (Media, error) {
	var m Media
	err := c.get(fmt.Sprintf("/api/tmdb/movie/%d", id), &m)
	return m, err
}

func (c *Client) TV(id int) (Media, error) {
	var m Media
	err := c.get(fmt.Sprintf("/api/tmdb/tv/%d", id), &m)
	return m, err
}

func (c *Client) Season(tvID, season int) (SeasonDetails, error) {
	var s SeasonDetails
	err := c.get(fmt.Sprintf("/api/tmdb/tv/%d/season/%d", tvID, season), &s)
	return s, err
}

func (c *Client) Sources(imdbID, mediaType, title, year string, season, episode int) ([]Stream, error) {
	q := url.Values{}
	q.Set("type", mediaType)
	if imdbID != "" {
		q.Set("imdbId", imdbID)
	}
	if title != "" {
		q.Set("title", title)
	}
	if year != "" {
		q.Set("year", year)
	}
	if mediaType == "tv" {
		if season > 0 {
			q.Set("season", fmt.Sprintf("%d", season))
		}
		if episode > 0 {
			q.Set("episode", fmt.Sprintf("%d", episode))
		}
	}
	var out SourcesResponse
	if err := c.get("/api/stream/sources?"+q.Encode(), &out); err != nil {
		return nil, err
	}
	return out.Streams, nil
}

func (c *Client) StartStream(magnet, mediaID, mediaType, title string) (Session, error) {
	payload, _ := json.Marshal(map[string]string{
		"magnet":    magnet,
		"mediaId":   mediaID,
		"mediaType": mediaType,
		"title":     title,
	})
	resp, err := c.HTTP.Post(c.Base+"/api/stream/start", "application/json", bytes.NewReader(payload))
	if err != nil {
		return Session{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if resp.StatusCode >= 400 {
		return Session{}, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var s Session
	err = json.Unmarshal(body, &s)
	return s, err
}

func (c *Client) Status(infoHash string) (Session, error) {
	var s Session
	err := c.get("/api/stream/status/"+url.PathEscape(infoHash), &s)
	return s, err
}

func (c *Client) DirectURL(s Session) string {
	if strings.HasPrefix(s.DirectStreamURL, "http") {
		return s.DirectStreamURL
	}
	path := s.DirectStreamURL
	if path == "" {
		path = "/api/stream/direct/" + s.InfoHash
		if s.Magnet != "" {
			path += "?magnet=" + url.QueryEscape(s.Magnet)
		}
	} else if strings.HasPrefix(path, "/") {
		path = path
	}
	if strings.HasPrefix(path, "/") {
		return c.Base + path
	}
	return c.Base + "/" + path
}

func PickBest(streams []Stream) *Stream {
	if len(streams) == 0 {
		return nil
	}
	for i := range streams {
		if streams[i].HasPtBr && streams[i].IsDubbed {
			return &streams[i]
		}
	}
	for i := range streams {
		if streams[i].HasPtBr {
			return &streams[i]
		}
	}
	return &streams[0]
}
