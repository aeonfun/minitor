"use client";

import { Sparkles } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type WeiboHotConfig, type WeiboHotMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<WeiboHotConfig>) {
  return (
    <NewsNowConfigHint description="Live Weibo Hot Search board (微博热搜). Aggregated via the NewsNow public API — no key needed." />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: Sparkles,
  accent: "#e6162d",
  badgeLabel: "Weibo",
});

export const column = defineColumnUI<WeiboHotConfig, WeiboHotMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
