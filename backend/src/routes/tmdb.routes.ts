import { Router } from 'express';
import { tmdbService } from '../services/tmdb.service.js';

export const tmdbRouter = Router();

// Trending
tmdbRouter.get('/trending', async (req, res) => {
  try {
    const type = (req.query.type as any) || 'all';
    const timeWindow = (req.query.timeWindow as any) || 'week';
    const page = parseInt(req.query.page as string || '1', 10);
    const data = await tmdbService.getTrending(type, timeWindow, page);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Popular
tmdbRouter.get('/popular', async (req, res) => {
  try {
    const type = (req.query.type as any) || 'movie';
    const page = parseInt(req.query.page as string || '1', 10);
    const data = await tmdbService.getPopular(type, page);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Top Rated
tmdbRouter.get('/top-rated', async (req, res) => {
  try {
    const type = (req.query.type as any) || 'movie';
    const page = parseInt(req.query.page as string || '1', 10);
    const data = await tmdbService.getTopRated(type, page);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// By Genre
tmdbRouter.get('/genre/:type/:id', async (req, res) => {
  try {
    const type = req.params.type as 'movie' | 'tv';
    const genreId = parseInt(req.params.id, 10);
    const page = parseInt(req.query.page as string || '1', 10);
    const data = await tmdbService.getByGenre(type, genreId, page);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Advanced Discover & Vibe Recommendations
tmdbRouter.get('/discover', async (req, res) => {
  try {
    const mediaType = (req.query.type as any) || 'movie';
    const genreId = req.query.genreId ? parseInt(req.query.genreId as string, 10) : undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
    const maxRuntime = req.query.maxRuntime ? parseInt(req.query.maxRuntime as string, 10) : undefined;
    const minRuntime = req.query.minRuntime ? parseInt(req.query.minRuntime as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const fromYear = req.query.fromYear ? parseInt(req.query.fromYear as string, 10) : undefined;
    const toYear = req.query.toYear ? parseInt(req.query.toYear as string, 10) : undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const vibe = req.query.vibe as string | undefined;

    const data = await tmdbService.discover({
      mediaType,
      genreId,
      sortBy,
      minRating,
      maxRuntime,
      minRuntime,
      year,
      fromYear,
      toYear,
      page,
      vibe,
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Surprise Me / Smart Roulette
tmdbRouter.get('/surprise', async (req, res) => {
  try {
    const vibe = req.query.vibe as string | undefined;
    const type = ((req.query.type as string) || 'movie') as 'movie' | 'tv';
    const item = await tmdbService.getSurpriseRecommendation(vibe, type);
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Genres list
tmdbRouter.get('/genres', async (req, res) => {
  try {
    const type = (req.query.type as any) || 'movie';
    const data = await tmdbService.getGenres(type);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Search
tmdbRouter.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string || '1', 10);
    if (!query) {
      return res.json({ page: 1, totalPages: 0, results: [] });
    }
    const data = await tmdbService.search(query, page);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Movie Details
tmdbRouter.get('/movie/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await tmdbService.getMovieDetails(id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// TV Show Details
tmdbRouter.get('/tv/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = await tmdbService.getTvDetails(id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// TV Season Details
tmdbRouter.get('/tv/:id/season/:seasonNumber', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const seasonNumber = parseInt(req.params.seasonNumber, 10);
    const data = await tmdbService.getSeasonDetails(id, seasonNumber);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
