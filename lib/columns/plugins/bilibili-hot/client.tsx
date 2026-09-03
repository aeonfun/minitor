"use client";

import { Tv2 } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type BilibiliHotConfig, type BilibiliHotMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<BilibiliHotConfig>) {
  return (
    <NewsNowConfigHint description="Live Bilibili Hot Search board — trending videos and topics across the platform." />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: Tv2,
  accent: "#fb7299",
  badgeLabel: "Bilibili",
});

export const column = defineColumnUI<BilibiliHotConfig, BilibiliHotMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
