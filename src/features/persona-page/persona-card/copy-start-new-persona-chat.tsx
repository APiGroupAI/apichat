"use client";

import { Button } from "@/features/ui/button";
import { ClipboardCheckIcon, LinkIcon } from "lucide-react";
import { FC, useEffect, useState } from "react";
import { useToast } from "@/features/ui/use-toast";

interface Props {
  id: string;
}

export const CopyStartNewPersonaChat: FC<Props> = ({ id }) => {
  const [origin, setOrigin] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // window is only defined on client
    setOrigin(window.location.origin);
  }, []);

  const handleCopy = () => {
    if (!origin || !id) return;
    const url = `${origin}/chat/create/persona/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" onClick={handleCopy} className="gap-2">
      {copied ? <ClipboardCheckIcon size={18} /> : <LinkIcon size={18} />}
      Copy link
    </Button>
  );
}; 