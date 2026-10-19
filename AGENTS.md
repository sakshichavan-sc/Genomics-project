<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Use the uploaded registry ABI as the deployed interface; legacy contracts are not deployment-compatible, preventing accidental redeployment of a different registry.
- Hash NFC-normalized project and analysis strings with keccak256 and use an explicit uint32 manifest version (legacy manifests default to 1), ensuring registration and verification address the same record.
- Keep manifest bytes and artifact hashes on-device; derive public registry activity from contract events and refresh via shared query keys, preserving privacy without fabricated data.
- Persist passports during creation, before showing success, and include local creation records in dashboard activity and charts so navigation never hides an unsaved preview.
- Broadcast wallet connection and network changes to every mounted wallet consumer so shared controls stay synchronized after a user request.
