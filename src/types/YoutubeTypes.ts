export type YoutubeSearchListResponse = {
  kind: "youtube#searchListResponse";
  etag: string;
  nextPageToken?: string;
  regionCode: string;
  pageInfo: YoutubePageInfo;
  items: YoutubeSearchResult[];
};

export type YoutubePageInfo = {
  totalResults: number;
  resultsPerPage: number;
};

export type YoutubeSearchResult = {
  kind: "youtube#searchResult";
  etag: string;
  id: YoutubeResourceId;
  snippet: YoutubeSnippet;
};
export type YoutubeDetailsResult = {
  categroyId: string
  channel: string
  duration: string
  embeddable: boolean
  id: string
  lengthSeconds: number
  publishedAt: string
  thumbnail: string
  title: string
  views: string
}

export type YoutubeResourceId = YoutubeVideoResourceId | YoutubeChannelResourceId | YoutubePlaylistResourceId;

export type YoutubeVideoResourceId = {
  kind: "youtube#video";
  videoId: string;
};

export type YoutubeChannelResourceId = {
  kind: "youtube#channel";
  channelId: string;
};

export type YoutubePlaylistResourceId = {
  kind: "youtube#playlist";
  playlistId: string;
};

export type YoutubeSnippet = {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: YoutubeThumbnails;
  channelTitle: string;
  liveBroadcastContent: "none" | "live" | "upcoming";
  publishTime: string;
};

export type YoutubeThumbnails = {
  default: YoutubeThumbnail;
  medium: YoutubeThumbnail;
  high: YoutubeThumbnail;
};
export type YoutubeThumbnail = {
  url: string;
  width?: number;
  height?: number;
};

export type YoutubePlaylistResultType = {
  channel: string
  id: string
  publishedAt: string
  thumbnail: string
  title: string
  videoCount: string
  videos: YoutubeDetailsResult[]
}
