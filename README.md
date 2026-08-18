# cre-lab

Hands-on CRE gym. Operator-facing pages live at https://eclecticventures.net/tools/

- `hello-cron` official TypeScript hello
- `official-water` USGS Cameo + NASA POWER, two origins. Site identical. Stage and observation unix time median.
- Keeper lives in a sibling repo (do not copy it here)

```bash
export PATH="$HOME/.cre/bin:$PATH"
cd cre-lab
cre workflow simulate hello-cron --target staging-settings --non-interactive --trigger-index 0
cre workflow simulate official-water --target staging-settings --non-interactive --trigger-index 0
```

Start: [LAB.md](./LAB.md)

