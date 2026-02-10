# Copilot Instructions for rockrockrock

## First You must follow this

- **会話の区切りでは必ず `ask_Questions` を提示**し、次のアクション（複数可）と自由入力を受け取ること。会話を勝手に終了しない。
- **短く、事実ベースで簡潔に回答**すること。不要な長話や推測は避ける。

## `ask_Questions`（必須）
会話の区切り（あなたが通常EOFで終わるところ）では必ず`ask_Questions`ツールを続けるのまま続けてください。ユーザーは選択肢から選ぶか自由入力ができます（**必ず自由入力を許可すること**）。

表示時の注意:
- 表示する選択肢は3つ前後にまとめると親切です。
- 最後に必ず「その他、要望があれば入力してください」の自由入力欄を含めてください。

**このテンプレートに従わない応答は避けてください。必ず `ask_Questions` を提示して会話を続けてください。**

## プロジェクト概要

本プロジェクトは PixiJS v8.8.1 と TypeScript を用いた idle/incremental（放置系）ゲームです。コンセプトは岩（rock）を加工して様々なアイテムを作り出すインクリメンタルなゲームプレイ（Factorio 的な要素を含む）です。学習目的と実装の両方を兼ねています。

## ビルド・実行・Lint（例）

```bash
# 開発サーバ（ホットリロード）
pnpm dev
# または: npm run dev（エイリアス）
npm start

# 本番ビルド（Lint + TypeScript チェック + Vite ビルド）
pnpm build

# Lint のみ
pnpm lint
```

## 主要なコーディング規約

### PixiJS の慣習

1. **ワールドへの要素追加**: 直接 `world.addChild()` を使わず、必ず `addItem()` または `addItems()` ヘルパーを使ってください。これらは自動で `eventMode = "static"` を設定し、適切なイベント検出を保証します。

   ```typescript
   // ✅ 正しい例
   addItem(sprite);
   addItems(sprite1, sprite2, sprite3);
   
   // ❌ 避ける例
   world.addChild(sprite);
   ```

2. **グローバル Pixi アプリ参照**: デバッグ目的でアプリケーションインスタンスを `globalThis.__PIXI_APP__` に設定しています。

3. **イベント処理**: インタラクティブな要素は `eventMode = "static"` を設定して、イベントターゲットとして検出されるようにしてください（ドラッグ透過の問題を回避）。

4. **グリッド描画**: `pixelLine: true` を使い、任意のズームレベルでも 1px のラインが鮮明に表示されるようにします。

### コードスタイル

- TypeScript は `strict: true` を前提とする。
- 未使用のローカル変数/引数はエラーとする（`noUnusedLocals`, `noUnusedParameters`）。
- ESLint と Prettier を組み合わせてコードスタイルを統一する。
- モジュールシステムは ES Modules（`"type": "module"`）を利用する。

### 技術メモ（AI_MEMOs.md より抜粋）

- レンダラーのリサイズ時に `grid.width/height` を更新してレスポンシブなグリッドを維持する。
- ステージの `pointerdown` ハンドラでは `event.target` を確認してドラッグの開始判定を行う。
- インタラクティブ要素には常に `eventMode = "static"` を設定する。
- 慣習的な処理はヘルパー関数で自動化しておくと安全です。

## File Organization

```
src/
  main.ts              # Application entry point
  scrollableWorld.ts   # Drag-to-pan world with grid
public/
  assets/             # Game assets (images, etc.)
  style.css           # Global styles
  favicon.png
index.html            # HTML entry point with #pixi-container
```

## Language

Project documentation is in Japanese (README, comments may be mixed Japanese/English).
