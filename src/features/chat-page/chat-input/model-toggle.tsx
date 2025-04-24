"use client";

import React from "react";
import { chatStore, useChat } from "../chat-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/features/ui/tooltip";
import { Switch } from "@/features/ui/switch";
import { Label } from "@/features/ui/label";
import { Sparkles } from "lucide-react";

export const ModelToggle = () => {
  const { modelType } = useChat();
  const isAdvanced = modelType === "o3_reasoning";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2 pl-2 ml-1">
            <Switch
              checked={isAdvanced}
              onCheckedChange={(checked) => {
                chatStore.updateModelType(checked ? "o3_reasoning" : "default");
              }}
              id="model-toggle"
            />
            <Label 
              htmlFor="model-toggle" 
              className={`text-xs cursor-pointer flex items-center ${isAdvanced ? 'text-primary font-semibold' : ''}`}
            >
              {isAdvanced ? (
                <span className="flex items-center gap-1">
                  Advanced Reasoning
                  <Sparkles size={12} className="text-yellow-400 animate-pulse" />
                </span>
              ) : "Standard"}
            </Label>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-xs text-sm">
            Toggle to switch between the standard model and the advanced reasoning model for more complex queries.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 