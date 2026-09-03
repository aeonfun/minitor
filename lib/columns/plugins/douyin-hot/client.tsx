"use client";

import { Video } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type DouyinHotConfig, type DouyinHotMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<DouyinHotConfig>) {
  return (
    <NewsNowConfigHint description="Live Douyin (Chinese TikTok) Hot board — trending short-video topics in China." />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: Video,
  accent: "#161823",
  badgeLabel: "Douyin",
});

export const column = defineColumnUI<DouyinHotConfig, DouyinHotMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
