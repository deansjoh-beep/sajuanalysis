import type { BlogPost } from '../constants/blog';

export const stripRichText = (content: string) => {
  return content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const createDefaultNewPost = (): Partial<BlogPost> => ({
  title: '',
  content: '',
  seoTitle: '',
  seoDescription: '',
  ogImageUrl: '',
  category: '사주기초',
  excerpt: '',
  readTime: '3분',
  imageUrl: `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/600`,
});
