import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import CharacterCount from '@tiptap/extension-character-count';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckSquare,
  Table2,
  Minus,
  Undo2,
  Redo2,
  Eye,
  CodeXml,
  Maximize,
  Minimize,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Video,
  Instagram,
  ExternalLink
} from 'lucide-react';

interface BlogRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const isLikelyHtml = (text: string) => /<\/?[a-z][\s\S]*>/i.test(text);

const extractYouTubeVideoId = (url: string) => {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/,
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const extractInstagramEmbedPath = (url: string) => {
  const match = url.match(/instagram\.com\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `${match[1]}/${match[2]}`;
};

const escapeAttr = (value: string) => value.replace(/"/g, '&quot;');

const ToolbarButton: React.FC<{
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active = false, onClick, title, children }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-h-[40px] min-w-[40px] rounded-xl border text-zinc-700 transition-all ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white/80 border-zinc-200 hover:bg-indigo-50 hover:border-indigo-300'
      }`}
    >
      <span className="inline-flex items-center justify-center">{children}</span>
    </button>
  );
};

const BlogRichEditor: React.FC<BlogRichEditorProps> = ({
  value,
  onChange,
  placeholder = '내용을 작성하세요...',
  minHeight = '360px'
}) => {
  const [sourceMode, setSourceMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialContent = useMemo(() => {
    if (!value) return '<p></p>';
    if (isLikelyHtml(value)) return value;
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    return `<p>${escaped}</p>`;
  }, [value]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true }
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank'
        }
      }),
      Image.configure({
        allowBase64: true,
        inline: false
      }),
      Placeholder.configure({
        placeholder
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          'prose prose-zinc max-w-none p-4 md:p-5 focus:outline-none min-h-[inherit] leading-relaxed'
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
    }
  });

  useEffect(() => {
    if (!editor || sourceMode) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      const next = isLikelyHtml(value)
        ? value
        : `<p>${(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br />')}</p>`;
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value, sourceMode]);

  if (!editor) {
    return <div className="text-[11px] text-zinc-500 px-3 py-2">에디터 초기화 중...</div>;
  }

  const insertImageFromUrl = () => {
    const url = window.prompt('이미지 URL을 입력하세요');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('링크 URL을 입력하세요', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImageFromFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        editor.chain().focus().setImage({ src: result }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  const insertYouTubeEmbed = () => {
    const url = window.prompt('유튜브 URL을 입력하세요');
    if (!url) return;

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      alert('올바른 유튜브 URL을 입력해 주세요.');
      return;
    }

    const embedHtml = `<div class="embed-wrap" data-embed="youtube"><iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><p></p>`;
    editor.chain().focus().insertContent(embedHtml).run();
  };

  const insertInstagramEmbed = () => {
    const url = window.prompt('인스타그램 게시물 URL을 입력하세요');
    if (!url) return;

    const embedPath = extractInstagramEmbedPath(url);
    if (!embedPath) {
      alert('올바른 인스타그램 게시물 URL을 입력해 주세요.');
      return;
    }

    const embedHtml = `<div class="embed-wrap" data-embed="instagram"><iframe src="https://www.instagram.com/${embedPath}/embed" title="Instagram post" loading="lazy" allowtransparency="true"></iframe></div><p></p>`;
    editor.chain().focus().insertContent(embedHtml).run();
  };

  const insertLinkCard = () => {
    const url = window.prompt('카드로 넣을 링크 URL을 입력하세요', 'https://');
    if (!url) return;

    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      alert('올바른 URL 형식이 아닙니다.');
      return;
    }

    const safeUrl = escapeAttr(url);
    const safeHost = escapeAttr(hostname);
    const cardHtml = `<a class="embed-link-card" href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow"><span class="embed-link-label">외부 링크</span><strong>${safeHost}</strong><span class="embed-link-url">${safeUrl}</span></a><p></p>`;
    editor.chain().focus().insertContent(cardHtml).run();
  };

  const words = (editor.storage.characterCount?.words?.() as number) || 0;
  const characters = (editor.storage.characterCount?.characters?.() as number) || 0;

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-[120] bg-zinc-100 p-4 md:p-6' : ''}`}>
      <div className="rounded-2xl border border-zinc-200 bg-white/70 backdrop-blur shadow-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-zinc-200 bg-zinc-50/80">
          <button
            type="button"
            onClick={() => setSourceMode(false)}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold ${
              !sourceMode ? 'bg-indigo-600 text-white' : 'bg-white text-zinc-600 border border-zinc-200'
            }`}
          >
            비주얼
          </button>
          <button
            type="button"
            onClick={() => setSourceMode(true)}
            className={`px-3 py-2 rounded-xl text-[11px] font-bold ${
              sourceMode ? 'bg-indigo-600 text-white' : 'bg-white text-zinc-600 border border-zinc-200'
            }`}
          >
            HTML 소스
          </button>

          <div className="w-px h-8 bg-zinc-300 mx-1" />

          <ToolbarButton title="굵게" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="기울임" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="밑줄" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="취소선" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="하이라이트" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')}>
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton title="제목 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="제목 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="제목 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton title="글머리" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="번호 목록" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="체크리스트" onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')}>
            <CheckSquare className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton title="인용문" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="코드 블록" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')}>
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton title="왼쪽 정렬" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="가운데 정렬" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="오른쪽 정렬" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>

          <ToolbarButton title="링크" onClick={insertLink} active={editor.isActive('link')}>
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="이미지 URL" onClick={insertImageFromUrl}>
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="표 삽입" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="유튜브 임베드" onClick={insertYouTubeEmbed}>
            <Video className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="인스타그램 임베드" onClick={insertInstagramEmbed}>
            <Instagram className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton title="링크 카드" onClick={insertLinkCard}>
            <ExternalLink className="w-4 h-4" />
          </ToolbarButton>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              insertImageFromFile(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl text-[11px] font-bold bg-white border border-zinc-200 hover:bg-indigo-50"
          >
            이미지 업로드
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ToolbarButton title="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
              <Undo2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
              <Redo2 className="w-4 h-4" />
            </ToolbarButton>
            <button
              type="button"
              onClick={() => setSourceMode((prev) => !prev)}
              className="min-h-[40px] min-w-[40px] rounded-xl border border-zinc-200 bg-white/80 hover:bg-indigo-50"
              title="미리보기/소스 전환"
            >
              {sourceMode ? <Eye className="w-4 h-4 mx-auto" /> : <CodeXml className="w-4 h-4 mx-auto" />}
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="min-h-[40px] min-w-[40px] rounded-xl border border-zinc-200 bg-white/80 hover:bg-indigo-50"
              title="전체화면"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 mx-auto" /> : <Maximize className="w-4 h-4 mx-auto" />}
            </button>
          </div>
        </div>

        <div style={{ minHeight }} className="bg-white">
          {sourceMode ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-full min-h-[inherit] p-4 md:p-5 font-mono text-[13px] leading-relaxed outline-none resize-y"
              placeholder="HTML 또는 기존 마크다운 소스를 직접 편집하세요."
            />
          ) : (
            <EditorContent editor={editor} className="min-h-[inherit]" />
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-200 bg-zinc-50/80 text-[11px] text-zinc-500 flex items-center justify-between">
          <span>단어 {words.toLocaleString()} / 글자 {characters.toLocaleString()}</span>
          <span>티스토리/워드프레스형 편집: 문단, 표, 체크리스트, 코드블록, 이미지 지원</span>
        </div>
      </div>
    </div>
  );
};

export default BlogRichEditor;
