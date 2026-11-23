# TASKS TODO

## Variant Cards in the Settings View

In the settings view (`gurita-vscode/src/webview/page.ts`, its stylesheet in `gurita-vscode/src/pane.ts`), each variant listed under Variants and under Single-task lines, the deleted ones included, is drawn as a card of its own: indented under its recipe or line heading, with a vertical line down its left edge and space between cards, because recipes and their variants are hard to tell apart there today. The change is display only, with no control, message, or stored value changed. It is verified by a page test of the card markup against the stylesheet rule and by `gurita-vscode/README.md` describing the settings view's layout, with `npm test` passing under Node 22.

---
