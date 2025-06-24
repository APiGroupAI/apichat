"use client";

import { Button } from "@/features/ui/button";
import { ClipboardCheckIcon, LinkIcon } from "lucide-react";
import { FC, useEffect, useState } from "react";
import { useToast } from "@/features/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
} from "@/features/ui/tooltip";

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            onClick={handleCopy}
            size="icon"
            className="w-9 h-9"
          >
            {copied ? <ClipboardCheckIcon size={18} /> : <LinkIcon size={18} />}
          </Button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="top">Copy link to share with others</TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}; 