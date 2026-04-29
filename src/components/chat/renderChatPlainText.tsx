import React from 'react';

export const renderChatPlainText = (text: string) => {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return <p className="whitespace-pre-line">{text}</p>;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => (
        <p key={idx} className="whitespace-pre-line leading-relaxed">
          {block}
        </p>
      ))}
    </div>
  );
};
