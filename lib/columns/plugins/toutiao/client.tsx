"use client";

import { Newspaper } from "lucide-react";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import {
  makeNewsNowItemRenderer,
  NewsNowConfigHint,
} from "@/lib/columns/plugins/_newsnow/renderer";
import { meta, type ToutiaoConfig, type ToutiaoMeta } from "./plugin";

function ConfigForm(_: ConfigFormProps<ToutiaoConfig>) {
  return (
    <NewsNowConfigHint
      description={`Live Toutiao ("Today's Headlines") feed — algorithmic news aggregator from ByteDance.`}
    />
  );
}

const ItemRenderer = makeNewsNowItemRenderer({
  icon: Newspaper,
  accent: "#fc4f4f",
  badgeLabel: "Toutiao",
});

export const column = defineColumnUI<ToutiaoConfig, ToutiaoMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
