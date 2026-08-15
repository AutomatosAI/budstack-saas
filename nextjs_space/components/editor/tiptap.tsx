'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

interface TiptapProps {
    content: string;
    onChange: (content: string) => void;
    editable?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    const addImage = () => {
        const url = window.prompt('URL');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    return (
        <div className="border border-input bg-transparent rounded-t-md p-2 flex flex-wrap gap-1 items-center">
            <Toggle
                size="sm"
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                aria-label="Toggle bold"
            >
                <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                aria-label="Toggle italic"
            >
                <Italic className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Toggle
                size="sm"
                pressed={editor.isActive('heading', { level: 1 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                aria-label="Toggle H1"
            >
                <Heading1 className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('heading', { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                aria-label="Toggle H2"
            >
                <Heading2 className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Toggle
                size="sm"
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                aria-label="Toggle bullet list"
            >
                <List className="h-4 w-4" />
            </Toggle>
            <Toggle
                size="sm"
                pressed={editor.isActive('orderedList')}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                aria-label="Toggle ordered list"
            >
                <ListOrdered className="h-4 w-4" />
            </Toggle>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Toggle
                size="sm"
                pressed={editor.isActive('blockquote')}
                onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                aria-label="Toggle quote"
            >
                <Quote className="h-4 w-4" />
            </Toggle>

            <Button variant="ghost" size="sm" onClick={addImage} type="button">
                <ImageIcon className="h-4 w-4" />
            </Button>

            <div className="flex-1" />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
            >
                <Undo className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
            >
                <Redo className="h-4 w-4" />
            </Button>
        </div>
    );
};

const Tiptap = ({ content, onChange, editable = true }: TiptapProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image,
        ],
        content: content,
        editable: editable,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                // `bs-article`, not the old `prose-*` chain: @tailwindcss/typography
                // is not installed, so those classes styled nothing and authors
                // wrote long-form posts with no visible formatting at all.
                //
                // This editor renders on admin surfaces (.budstacks-theme sets a
                // near-black --background), which is what bs-article's light body
                // colour is built for. It shows STRUCTURE — heading rhythm, list
                // markers, quotes, code. A tenant's published post takes its brand
                // colours from `.tenant-article` instead (tenant-theme-provider),
                // so the hues here are the platform's, not a preview of theirs.
                class: 'bs-article mx-auto focus:outline-none min-h-[300px] p-4 border border-t-0 rounded-b-md border-input bg-background',
            },
        },
    });

    return (
        <div className="w-full">
            {editable && <MenuBar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
};

export default Tiptap;
