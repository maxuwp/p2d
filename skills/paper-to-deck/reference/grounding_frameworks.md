# Paper-to-Deck Grounding Frameworks — the master map

**Rule: no p2d stage invents its own process, criteria, or rubric when an established,
citable framework exists.** Every stage names its anchor framework(s); drafters and
reviewers state which framework they are using, cited FOR its original scope, never
stretched. "We made it up ourselves" is a review finding. (Same rule as the sibling POSED
plugin; this map is p2d's presentation-specific counterpart.)

**Staleness:** this map is a snapshot. Re-check anchors and new AI capabilities
periodically (~90 days) using the refresh pattern from the POSED plugin (`posed-refresh`);
propose changes as an approve-per-item ledger, never auto-apply.

| Stage | Anchor framework(s) | How applied |
|---|---|---|
| 1. Ingest (MCS + PSE) | **Doumont** (message before medium; adapt to audience); **Alley** (the critical assertion) | The MCS is the talk's ONE message, stated as an assertion in the presenter's words; the PSE list is the paper's real structure, not the AI's preferred structure. Anti-divergence = message discipline |
| 1.5 Verify | **SIFT — trace claims** (Caulfield) | Every analysis claim is traced to its exact location in the paper (the paper is the ground truth corpus); untraceable claims are flagged, not smoothed over |
| 2. Persona (presentation style) | **Doumont's audience law** | Delivery voice, pacing, and register are derived from the audience mode first, presenter preference second; the style profile states both |
| 3. Outline | **CLT segmenting** (Sweller); **Doumont**; PSE anchoring | One PSE per section; slide budget from duration; no section outweighs its share of the time budget without a stated reason; two-agent review ≥85 before the gate |
| 4a. Slides | **Mayer's multimedia principles**; **assertion–evidence** (Alley) | Headlines are sentence assertions traced to the paper; bodies are evidence (visuals over bullet walls); coherence (cut seductive details), signaling, redundancy (slides ≠ script) |
| 4b. Notes | **Mayer segmenting**; timing discipline | Notes are the script (redundancy principle: they carry what slides don't); word count fits the per-section time budget at speaking pace |
| Stage 2 Humanizer | **Wikipedia "Signs of AI Writing"**; blader/humanizer + stop-slop taxonomies | 32-pattern removal + presenter-voice re-grounding; scored /50, threshold 40 (already source-backed — keep citations in p2d-humanizer) |
| 5a. Style / 5b. Compile | **Kosslyn's psychological principles**; **Mayer**; Fit-First Layout Protocol | Discriminability/salience govern template + layout choices; locked fonts, capacity budgets, geometric overflow scan |
| Reviews (editor, final) | This map + faithfulness-to-paper weighting | Reviewers score against named frameworks and the paper itself, not personal taste; every major finding cites its framework or the paper section |

## Citations

- Doumont, J.-L. (2009). *Trees, Maps, and Theorems: Effective Communication for Rational Minds.* Principiae. (Three laws: adapt to the audience, maximize signal-to-noise, use effective redundancy.)
- Alley, M. (2013). *The Craft of Scientific Presentations* (2nd ed.). Springer. (Assertion–evidence structure; the critical assertion.)
- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press. (Coherence, signaling, redundancy, segmenting, modality.)
- Kosslyn, S. M. (2007). *Clear and to the Point: 8 Psychological Principles for Compelling PowerPoint Presentations.* Oxford University Press.
- Sweller, J., van Merriënboer, J., & Paas, F. (1998). Cognitive architecture and instructional design. *Educational Psychology Review*, 10, 251–296.
- Caulfield, M. (2019). SIFT — The Four Moves. hapgood.us/2019/06/19/sift-the-four-moves/. (Used here for the "trace claims to the original context" move — p2d-verify traces analysis claims to the paper.)
- Wikipedia: Signs of AI Writing (WikiProject AI Cleanup); blader/humanizer; hardikpandya/stop-slop. (Humanizer taxonomy — already cited in `p2d-humanizer`.)

## Scope notes

- Doumont/Alley/Kosslyn/Mayer are communication and presentation-design frameworks — they
  govern the deck and delivery, not pedagogy. For classroom-teaching decks
  (`undergrad-intro` audience mode), the POSED grounding map's instructional anchors
  (Gagné, ICAP) may additionally apply — say so when they do.
- SIFT is a source-evaluation method; p2d uses only its claim-tracing move, against a
  single known-good source (the paper).
