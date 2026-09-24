import axios from 'axios';
import { config } from '../config/index.js';

class TmdbService {
  private client = axios.create({
    baseURL: config.tmdb.baseUrl,
    headers: {
      Authorization: `Bearer ${config.tmdb.readToken}`,
      'Content-Type': 'application/json',
    },
    params: {
      language: 'pt-BR',
      include_adult: true,
    },
  });

  async getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week', page: number = 1) {
    const response = await this.client.get(`/trending/${mediaType}/${timeWindow}`, {
      params: { page, include_adult: true },
    });
    return this.formatResults(response.data.results);
  }

  async getPopular(mediaType: 'movie' | 'tv' = 'movie', page = 1) {
    const response = await this.client.get(`/${mediaType}/popular`, {
      params: { page, include_adult: true },
    });
    return {
      page: response.data.page,
      totalPages: response.data.total_pages,
      totalResults: response.data.total_results,
      results: this.formatResults(response.data.results, mediaType),
    };
  }

  async getTopRated(mediaType: 'movie' | 'tv' = 'movie', page = 1) {
    const response = await this.client.get(`/${mediaType}/top_rated`, {
      params: { page, include_adult: true },
    });
    return {
      page: response.data.page,
      totalPages: response.data.total_pages,
      totalResults: response.data.total_results,
      results: this.formatResults(response.data.results, mediaType),
    };
  }

  async getByGenre(mediaType: 'movie' | 'tv', genreId: number, page = 1) {
    const response = await this.client.get(`/discover/${mediaType}`, {
      params: {
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page,
        include_adult: true,
      },
    });
    return {
      page: response.data.page,
      totalPages: response.data.total_pages,
      results: this.formatResults(response.data.results, mediaType),
    };
  }

  async discover(params: {
    mediaType?: 'movie' | 'tv';
    genreId?: number | string;
    sortBy?: string;
    minRating?: number;
    maxRating?: number;
    minVoteCount?: number;
    maxRuntime?: number;
    minRuntime?: number;
    year?: number;
    fromYear?: number;
    toYear?: number;
    language?: string;
    page?: number;
    vibe?: string;
  }) {
    const mediaType = params.mediaType || 'movie';
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      include_adult: true,
    };

    queryParams.sort_by = params.sortBy || 'popularity.desc';

    if (params.genreId) {
      queryParams.with_genres = params.genreId;
    }

    if (params.minRating) {
      queryParams['vote_average.gte'] = params.minRating;
      queryParams['vote_count.gte'] = params.minVoteCount || 200;
    }

    if (params.maxRuntime) {
      queryParams['with_runtime.lte'] = params.maxRuntime;
    }
    if (params.minRuntime) {
      queryParams['with_runtime.gte'] = params.minRuntime;
    }

    if (params.year) {
      if (mediaType === 'tv') {
        queryParams.first_air_date_year = params.year;
      } else {
        queryParams.primary_release_year = params.year;
      }
    } else {
      if (params.fromYear) {
        if (mediaType === 'tv') queryParams['first_air_date.gte'] = `${params.fromYear}-01-01`;
        else queryParams['primary_release_date.gte'] = `${params.fromYear}-01-01`;
      }
      if (params.toYear) {
        if (mediaType === 'tv') queryParams['first_air_date.lte'] = `${params.toYear}-12-31`;
        else queryParams['primary_release_date.lte'] = `${params.toYear}-12-31`;
      }
    }

    // Vibe-based smart curation
    if (params.vibe) {
      switch (params.vibe) {
        case 'mind-bender': // Plot twists, suspense & psychological thrillers
          queryParams.with_genres = mediaType === 'tv' ? '9648|10765|80' : '53|878|9648';
          queryParams['vote_average.gte'] = 6.8;
          queryParams['vote_count.gte'] = mediaType === 'tv' ? 80 : 150;
          queryParams.sort_by = 'vote_average.desc';
          break;
        case 'adrenaline': // Pure action & adventure
          queryParams.with_genres = mediaType === 'tv' ? '10759' : '28|12';
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'relax': // Feel good & comedy
          queryParams.with_genres = mediaType === 'tv' ? '35|10762' : '35|10751';
          queryParams['vote_average.gte'] = 6.5;
          queryParams['vote_count.gte'] = 100;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'scary': // Horror & thrillers
          queryParams.with_genres = mediaType === 'tv' ? '9648' : '27|53';
          queryParams['vote_average.gte'] = 6.0;
          queryParams['vote_count.gte'] = 100;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'gems': // Hidden gems (high rating, decent vote count)
          queryParams['vote_average.gte'] = 7.8;
          queryParams['vote_count.gte'] = mediaType === 'tv' ? 100 : 200;
          queryParams.sort_by = 'vote_average.desc';
          break;
        case 'short': // Short movies under 95 minutes
          if (mediaType === 'movie') {
            queryParams['with_runtime.lte'] = 95;
            queryParams['with_runtime.gte'] = 70;
          }
          queryParams['vote_average.gte'] = 6.6;
          queryParams['vote_count.gte'] = 100;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'scifi': // Sci-Fi & fantasy
          queryParams.with_genres = mediaType === 'tv' ? '10765' : '878';
          queryParams['vote_average.gte'] = 6.8;
          queryParams['vote_count.gte'] = 150;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'animation': // Epic animation
          queryParams.with_genres = '16';
          queryParams['vote_average.gte'] = 7.2;
          queryParams['vote_count.gte'] = 150;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'brazil': // Brazilian cinema
          queryParams.with_original_language = 'pt';
          queryParams['vote_count.gte'] = 10;
          queryParams.sort_by = 'popularity.desc';
          break;
        case 'adult': // 18+ Uncensored & Mature content
          queryParams.certification_country = 'US';
          queryParams.certification = mediaType === 'tv' ? 'TV-MA' : 'NC-17';
          queryParams.sort_by = 'popularity.desc';
          break;
      }
    }

    const response = await this.client.get(`/discover/${mediaType}`, { params: queryParams });
    return {
      page: response.data.page,
      totalPages: response.data.total_pages,
      totalResults: response.data.total_results,
      results: this.formatResults(response.data.results, mediaType),
    };
  }

  async getSurpriseRecommendation(vibe?: string, mediaType: 'movie' | 'tv' = 'movie') {
    // Initial fetch to determine available page count
    const initial = await this.discover({
      mediaType,
      vibe: vibe || 'gems',
      page: 1,
    });

    let items = initial.results || [];
    if (items.length === 0) {
      // Fallback to top-rated if the specific vibe pool was empty
      const fallback = await this.getTopRated(mediaType, 1);
      items = fallback.results || [];
    }

    if (items.length === 0) return null;

    // If there are multiple pages, randomly select from up to 4 pages
    if (initial.totalPages > 1) {
      const randomPage = Math.floor(Math.random() * Math.min(initial.totalPages, 4)) + 1;
      if (randomPage > 1) {
        try {
          const pageRes = await this.discover({
            mediaType,
            vibe: vibe || 'gems',
            page: randomPage,
          });
          if (pageRes?.results && pageRes.results.length > 0) {
            items = pageRes.results;
          }
        } catch {}
      }
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    const chosen = items[randomIndex];
    if (mediaType === 'movie') {
      return await this.getMovieDetails(chosen.id);
    } else {
      return await this.getTvDetails(chosen.id);
    }
  }

  async getGenres(mediaType: 'movie' | 'tv' = 'movie') {
    const response = await this.client.get(`/genre/${mediaType}/list`);
    return response.data.genres;
  }

  async search(query: string, page = 1) {
    const response = await this.client.get('/search/multi', {
      params: { query, page, include_adult: true },
    });
    const filtered = (response.data.results || []).filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );
    return {
      page: response.data.page,
      totalPages: response.data.total_pages,
      totalResults: response.data.total_results,
      results: this.formatResults(filtered),
    };
  }

  async getMovieDetails(id: number) {
    const response = await this.client.get(`/movie/${id}`, {
      params: {
        append_to_response: 'credits,videos,recommendations,external_ids',
      },
    });
    const d = response.data;
    const trailer = (d.videos?.results || []).find(
      (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    return {
      id: d.id,
      title: d.title,
      originalTitle: d.original_title,
      overview: d.overview,
      posterPath: d.poster_path ? `${config.tmdb.imageBaseUrl}/w500${d.poster_path}` : null,
      backdropPath: d.backdrop_path ? `${config.tmdb.imageBaseUrl}/original${d.backdrop_path}` : null,
      releaseDate: d.release_date,
      voteAverage: d.vote_average,
      voteCount: d.vote_count,
      mediaType: 'movie' as const,
      adult: Boolean(d.adult),
      runtime: d.runtime,
      genres: d.genres,
      imdbId: d.external_ids?.imdb_id || d.imdb_id,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      cast: (d.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path ? `${config.tmdb.imageBaseUrl}/w185${c.profile_path}` : null,
      })),
      recommendations: this.formatResults(d.recommendations?.results?.slice(0, 10) || [], 'movie'),
    };
  }

  async getTvDetails(id: number) {
    const response = await this.client.get(`/tv/${id}`, {
      params: {
        append_to_response: 'credits,videos,recommendations,external_ids',
      },
    });
    const d = response.data;
    const trailer = (d.videos?.results || []).find(
      (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );

    return {
      id: d.id,
      title: d.name,
      name: d.name,
      originalTitle: d.original_name,
      overview: d.overview,
      posterPath: d.poster_path ? `${config.tmdb.imageBaseUrl}/w500${d.poster_path}` : null,
      backdropPath: d.backdrop_path ? `${config.tmdb.imageBaseUrl}/original${d.backdrop_path}` : null,
      firstAirDate: d.first_air_date,
      voteAverage: d.vote_average,
      voteCount: d.vote_count,
      mediaType: 'tv' as const,
      adult: Boolean(d.adult),
      seasonsCount: d.number_of_seasons,
      episodesCount: d.number_of_episodes,
      seasons: (d.seasons || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        posterPath: s.poster_path ? `${config.tmdb.imageBaseUrl}/w500${s.poster_path}` : null,
      })),
      genres: d.genres,
      imdbId: d.external_ids?.imdb_id,
      trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
      cast: (d.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path ? `${config.tmdb.imageBaseUrl}/w185${c.profile_path}` : null,
      })),
      recommendations: this.formatResults(d.recommendations?.results?.slice(0, 10) || [], 'tv'),
    };
  }

  async getSeasonDetails(tvId: number, seasonNumber: number) {
    const response = await this.client.get(`/tv/${tvId}/season/${seasonNumber}`);
    const s = response.data;
    return {
      id: s.id,
      name: s.name,
      seasonNumber: s.season_number,
      overview: s.overview,
      episodes: (s.episodes || []).map((ep: any) => ({
        id: ep.id,
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        stillPath: ep.still_path ? `${config.tmdb.imageBaseUrl}/w500${ep.still_path}` : null,
        airDate: ep.air_date,
        voteAverage: ep.vote_average,
        runtime: ep.runtime,
      })),
    };
  }

  private formatResults(items: any[], defaultMediaType?: 'movie' | 'tv') {
    return items.map((item) => ({
      id: item.id,
      title: item.title || item.name,
      name: item.name || item.title,
      overview: item.overview,
      posterPath: item.poster_path ? `${config.tmdb.imageBaseUrl}/w500${item.poster_path}` : null,
      backdropPath: item.backdrop_path ? `${config.tmdb.imageBaseUrl}/original${item.backdrop_path}` : null,
      releaseDate: item.release_date || item.first_air_date,
      voteAverage: item.vote_average,
      mediaType: item.media_type || defaultMediaType || (item.first_air_date ? 'tv' : 'movie'),
      adult: Boolean(item.adult),
    }));
  }
}

export const tmdbService = new TmdbService();
