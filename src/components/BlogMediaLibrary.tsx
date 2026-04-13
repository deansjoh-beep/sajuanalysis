import React, { useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

export interface BlogMediaAsset {
  name: string;
  path: string;
  url: string;
}

interface BlogMediaLibraryProps {
  assets: BlogMediaAsset[];
  loading: boolean;
  error: string | null;
  selectedUrl?: string;
  onRefresh: () => void;
  onSelect: (asset: BlogMediaAsset) => void;
}

const BlogMediaLibrary: React.FC<BlogMediaLibraryProps> = ({
  assets,
  loading,
  error,
  selectedUrl,
  onRefresh,
  onSelect
}) => {
  const [query, setQuery] = useState('');

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) =>
      asset.name.toLowerCase().includes(q) || asset.path.toLowerCase().includes(q)
    );
  }, [assets, query]);

  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-50">미디어 라이브러리</p>
          <p className="text-[11px] text-zinc-500">업로드한 이미지를 다시 선택할 수 있어요.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-2 min-h-[40px] rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 flex items-center gap-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="파일명 검색"
          className="w-full pl-9 pr-3 py-2 min-h-[40px] rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-56 overflow-y-auto pr-1">
        {filteredAssets.map((asset) => {
          const isSelected = selectedUrl === asset.url;
          return (
            <button
              type="button"
              key={asset.path}
              onClick={() => onSelect(asset)}
              className={`rounded-xl overflow-hidden border text-left transition ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-300'
                  : 'border-zinc-200 hover:border-indigo-300'
              }`}
            >
              <div className="h-24 bg-zinc-100">
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[10px] text-zinc-600 truncate" title={asset.name}>{asset.name}</p>
              </div>
            </button>
          );
        })}
        {!loading && filteredAssets.length === 0 && (
          <div className="col-span-full text-xs text-zinc-500 py-4 text-center">표시할 이미지가 없습니다.</div>
        )}
      </div>
    </div>
  );
};

export default BlogMediaLibrary;
