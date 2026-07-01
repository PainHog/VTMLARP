/**
 * Parses a power's free-text `prerequisites` field (e.g. "Fortitude (1) or Potence (1), Presence (2)")
 * into an array of OR-groups, each an array of { name, rating } requirements. All OR-groups must be
 * satisfied (AND), but only one requirement within a group needs to be met (OR).
 */
export function parsePrerequisites(text) {
  if (!text) return [];
  return text.split(",").map(seg => seg.trim()).filter(Boolean).map(segment => {
    return segment.split(/\s+or\s+/i).map(part => {
      part = part.trim();
      const match = part.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
      if (!match) return { name: part, rating: 0 };
      const ratingMatch = match[2].match(/\d+/);
      return { name: match[1].trim(), rating: ratingMatch ? Number(ratingMatch[0]) : 0 };
    });
  });
}

/**
 * Checks parsed prerequisite groups against an actor's owned Discipline items. Matches by
 * case-insensitive substring since prerequisite names are sometimes abbreviated or annotated
 * (e.g. "Protean (Elder / Earth Control)"). Returns { met, missing } where missing lists the
 * OR-groups that had no satisfying Discipline, formatted for display.
 */
export function checkPrerequisites(prerequisitesText, disciplineItems) {
  const groups = parsePrerequisites(prerequisitesText);
  if (!groups.length) return { met: true, missing: [] };

  const owned = disciplineItems.map(i => ({ name: i.name, rating: i.system?.rating ?? 0 }));
  const missing = [];

  for (const group of groups) {
    const satisfied = group.some(req => {
      const disc = owned.find(d =>
        d.name.toLowerCase().includes(req.name.toLowerCase()) ||
        req.name.toLowerCase().includes(d.name.toLowerCase())
      );
      return disc && disc.rating >= req.rating;
    });
    if (!satisfied) missing.push(group.map(r => r.rating > 0 ? `${r.name} (${r.rating})` : r.name).join(" or "));
  }

  return { met: missing.length === 0, missing };
}
