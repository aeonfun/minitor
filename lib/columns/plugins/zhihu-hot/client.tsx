"use client";

import { MessageCircleQuestion } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type ZhihuHotConfig, type ZhihuHotMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<ZhihuHotConfig>) {
  return (
    <NewsNowConfigHint description="Live Zhihu Hot board — top trending questions and answers across the Q&A platform." />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: MessageCircleQuestion,
  accent: "#0084ff",
  badgeLabel: "Zhihu",
});

export const column = defineColumnUI<ZhihuHotConfig, ZhihuHotMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
