/**
 * MachineTypeDef → NodeData 変換ファクトリ
 *
 * 機械定義の inputPorts / outputPorts (PortDef[]) から
 * 実行時の PortData（portType 付き）を生成する。
 */

import type { MachineTypeDef } from "./nodeTypes.ts";
import type { NodeData } from "../nodeData.ts";
import { createNodeData, createPort } from "../nodeData.ts";

/** ポート間隔とタイトルバー高さ（node.ts と合わせる） */
const TITLE_BAR_HEIGHT = 28;
const PORT_TOP_MARGIN = 16;
const PORT_SPACING = 26;
const MAIN_MIN_HEIGHT = 60;

/** ポート数からノードの最小高さを算出 */
function calcMinHeight(inputCount: number, outputCount: number): number {
  const maxPorts = Math.max(inputCount, outputCount, 1);
  const portsHeight =
    PORT_TOP_MARGIN + maxPorts * PORT_SPACING + PORT_TOP_MARGIN;
  const bodyHeight = Math.max(
    portsHeight,
    MAIN_MIN_HEIGHT + PORT_TOP_MARGIN * 2,
  );
  return TITLE_BAR_HEIGHT + bodyHeight;
}

/**
 * MachineTypeDef からゲーム用 NodeData を生成する。
 * ポートの portType は MachineTypeDef.inputPorts/outputPorts の type から設定。
 */
export function createGameNode(
  typeDef: MachineTypeDef,
  x: number,
  y: number,
): NodeData {
  const inputs = typeDef.inputPorts.map((pd) =>
    createPort(pd.label, "input", pd.type),
  );

  const outputs = typeDef.outputPorts.map((pd) =>
    createPort(pd.label, "output", pd.type),
  );

  const minH = calcMinHeight(inputs.length, outputs.length);
  const height = Math.max(typeDef.height, minH);

  return createNodeData({
    x,
    y,
    title: typeDef.name,
    width: typeDef.width,
    height,
    titleColor: typeDef.titleColor,
    inputs,
    outputs,
    machineTypeId: typeDef.id,
  });
}
