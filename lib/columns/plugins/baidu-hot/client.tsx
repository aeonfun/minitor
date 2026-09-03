"use client";

import { Search } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type BaiduHotConfig, type BaiduHotMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<BaiduHotConfig>) {
  return (
    <NewsNowConfigHint description="Live Baidu Hot Search board — top trending searches across China's dominant search engine." />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: Search,
  accent: "#2932e1",
  badgeLabel: "Baidu",
});

export const column = defineColumnUI<BaiduHotConfig, BaiduHotMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
