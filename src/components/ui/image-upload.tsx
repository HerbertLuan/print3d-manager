"use client";

import { useState, useRef } from "react";
import { UploadCloud, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  onImageSelected: (file: File | null) => void;
}

export function ImageUpload({ onImageSelected }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onImageSelected(file);
    } else {
      setPreviewUrl(null);
      onImageSelected(null);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const onDragLeave = () => {
    setIsHovering(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const removeImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onImageSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        ref={inputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          handleFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)
        }
      />

      {!previewUrl ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isHovering
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-accent/50"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <UploadCloud className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Clique para enviar imagem</p>
          <p className="text-xs text-muted-foreground mt-1">
            ou arraste e solte o arquivo aqui
          </p>
        </div>
      ) : (
        <div className="relative border border-border rounded-lg overflow-hidden h-40 bg-black/10 flex items-center justify-center group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              variant="destructive"
              size="sm"
              onClick={removeImage}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Remover Imagem
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
