export default function CheatSheetPage() {
  return (
    <div className="grid md:grid-cols-2 gap-4 text-xs">
      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          National Indicator effects (per round)
        </h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-neutral-400">
              <th>Event</th><th>FES</th><th>SL</th><th>SC</th><th>PC</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t"><td>Natural decline</td><td colSpan={4}>Each indicator starts at 90% of previous value</td></tr>
            <tr className="border-t"><td>R&amp;C investment ($)</td><td>+40%</td><td>+10%</td><td>—</td><td>—</td></tr>
            <tr className="border-t"><td>Welfare investment ($)</td><td>—</td><td>+10%</td><td>+20%</td><td>+20%</td></tr>
            <tr className="border-t"><td>Each BASIN passage bought</td><td>−2</td><td>+1</td><td>—</td><td>—</td></tr>
            <tr className="border-t"><td>Each RETSIN anagram bought</td><td>—</td><td>+1</td><td>—</td><td>−1</td></tr>
            <tr className="border-t"><td>Each absentee</td><td>—</td><td>−2</td><td>—</td><td>−2</td></tr>
            <tr className="border-t"><td>Each unemployed</td><td>—</td><td>−3</td><td>−3</td><td>−1</td></tr>
            <tr className="border-t"><td>Riots (by % of society)</td><td>—</td><td>—</td><td>table</td><td>table</td></tr>
            <tr className="border-t"><td>Each guard post</td><td>—</td><td>—</td><td>−5</td><td>—</td></tr>
            <tr className="border-t"><td>Each arrest</td><td>—</td><td>—</td><td>−3</td><td>−3</td></tr>
            <tr className="border-t"><td>Each death</td><td>—</td><td>−5</td><td>−5</td><td>−5</td></tr>
            <tr className="border-t"><td>Goal declarations</td><td>—</td><td>—</td><td>—</td><td>+0.25/pos, −1/neg</td></tr>
            <tr className="border-t"><td>Floor</td><td colSpan={4}>No indicator may fall more than 30 below its previous value</td></tr>
          </tbody>
        </table>
        <h3 className="text-neutral-500 mt-3 mb-1">Riot effect on SC &amp; PC</h3>
        <table className="w-full border-collapse">
          <thead><tr className="text-left text-neutral-400"><th>% of society rioting</th><th>Effect</th></tr></thead>
          <tbody>
            <tr className="border-t"><td>0%</td><td>0</td></tr>
            <tr className="border-t"><td>&gt;0–14%</td><td>−2</td></tr>
            <tr className="border-t"><td>15–19%</td><td>−6</td></tr>
            <tr className="border-t"><td>20–24%</td><td>−12</td></tr>
            <tr className="border-t"><td>25–29%</td><td>−20</td></tr>
            <tr className="border-t"><td>≥30%</td><td>−30</td></tr>
          </tbody>
        </table>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mb-2">
          Income multiplier (lowest indicator)
        </h2>
        <table className="w-full border-collapse">
          <thead><tr className="text-left text-neutral-400"><th>Lowest indicator</th><th>Multiplier</th></tr></thead>
          <tbody>
            <tr className="border-t"><td>&gt;120</td><td>1.2</td></tr>
            <tr className="border-t"><td>90–120</td><td>1.0</td></tr>
            <tr className="border-t"><td>80–89</td><td>0.9</td></tr>
            <tr className="border-t"><td>70–79</td><td>0.8</td></tr>
            <tr className="border-t"><td>60–69</td><td>0.7</td></tr>
            <tr className="border-t"><td>50–59</td><td>0.6</td></tr>
            <tr className="border-t"><td>40–49</td><td>0.5</td></tr>
            <tr className="border-t"><td>30–39</td><td>0.4</td></tr>
            <tr className="border-t"><td>20–29</td><td>0.3</td></tr>
            <tr className="border-t"><td>10–19</td><td>0.2</td></tr>
            <tr className="border-t"><td>0–9</td><td>0.1</td></tr>
            <tr className="border-t"><td>&lt;0</td><td className="text-red-600 font-bold">SOCIETY COLLAPSES</td></tr>
          </tbody>
        </table>
        <h2 className="text-xs font-semibold tracking-wide text-blue-600 uppercase mt-3 mb-2">Group income rules</h2>
        <table className="w-full border-collapse">
          <thead><tr className="text-left text-neutral-400"><th>Group</th><th>Session 1</th><th>Later sessions (× multiplier)</th></tr></thead>
          <tbody>
            <tr className="border-t"><td>BASIN / RETSIN</td><td>Head income (level table)</td><td>10% of net assets</td></tr>
            <tr className="border-t"><td>POP / SOP</td><td>Start income (level table)</td><td>(support × start income ÷ population) × 2.5</td></tr>
            <tr className="border-t"><td>EMPIN / HUMSERV / MASMED</td><td>Level table</td><td>support cards × 2</td></tr>
            <tr className="border-t"><td>JUDCO</td><td colSpan={2}>0.75 × POP start income, every session</td></tr>
          </tbody>
        </table>
        <h3 className="text-neutral-500 mt-3 mb-1">Work payments</h3>
        <p className="text-neutral-500">
          BASIN passage: level-1 pay 50 − 4/error (scales ×1.5/2/2.5/3 by level); more than 6 errors ⇒ no payment.
          <br />
          RETSIN anagram: 12 per correct word at level 1 (scales likewise); max 5 words per anagram.
        </p>
        <h3 className="text-neutral-500 mt-3 mb-1">Session checklist</h3>
        <ol className="list-decimal ml-4 text-neutral-500 space-y-0.5">
          <li>Mark attendance / unemployment / deaths on the roster</li>
          <li>Collect subsistence &amp; luxury-living — flag NS / Lux</li>
          <li>Grade BASIN passages &amp; RETSIN anagrams; enter results</li>
          <li>Enter investments, purchases, support cards, riots/arrests/posts, goal declarations</li>
          <li>Close Session → distribute next-session payments from Results tab</li>
          <li>Print / read MasMed report to the society</li>
        </ol>
      </div>
    </div>
  );
}
