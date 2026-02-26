# NetBox Cable Diagram Generator

NetBox の `Cables` CSV (Export) から、結線図を自動生成する Python Web ツールです。

## セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

ブラウザで `http://localhost:8000` を開き、CSVをアップロードしてください。

## 保存仕様（永続化）

- 生成履歴のメタデータは `data/results.db` (SQLite) に保存
- アップロードしたCSVは `data/uploads/` に保存
- 生成した図データ（Cytoscape要素JSON）と行データは `data/results/` に保存
- 画面上の「保存済み結果」テーブルから、過去結果の再表示・CSV/JSONダウンロードが可能

## 想定CSV列

次のような列名を自動検出します（多少の揺らぎに対応）:

- `Device A`
- `Termination A`
- `Termination B`
- `Device B`
- `Label` (任意)
- `ID` (任意)
- `Type` (任意)
- `Color` (任意)

## 反映ルール

- `Label` が空なら `Cable-{ID}` を使用
- `Type` が空なら `Unknown` を使用
- `Color` が `#RRGGBB` 形式ならそのまま線色に利用
- `Color` が空/不正なら `Type` ごとの固定パレット色を自動割当

## 補足

- レイアウト描画は Cytoscape.js (CDN) を利用
- 列名の形式が大きく異なる場合は、`app.py` の `choose_columns()` の正規表現を追加
