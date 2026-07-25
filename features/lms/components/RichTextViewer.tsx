"use client";

interface RichTextViewerProps {
  content: string;
  className?: string;
}

export function RichTextViewer({ content, className = "" }: RichTextViewerProps) {
  return (
    <div 
      className={`prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
