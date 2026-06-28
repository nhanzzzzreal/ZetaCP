export const getTabTitles = (openTabs: string[]): Record<string, string> => {
  const titles: Record<string, string> = {};
  const groups: Record<string, string[]> = {};

  openTabs.forEach((p) => {
    const pClean = p.replace(/\\/g, '/');
    const filename = pClean.split('/').pop() || pClean;
    const lastDotIdx = filename.lastIndexOf('.');
    const baseNameWithoutExt = lastDotIdx <= 0 ? filename : filename.substring(0, lastDotIdx);

    if (!groups[baseNameWithoutExt]) {
      groups[baseNameWithoutExt] = [];
    }
    groups[baseNameWithoutExt].push(p);
  });

  Object.entries(groups).forEach(([_, paths]) => {
    if (paths.length === 1) {
      const p = paths[0];
      const pClean = p.replace(/\\/g, '/');
      titles[p] = pClean.split('/').pop() || p;
      return;
    }

    const parentPathsOfGroup = paths.map((p) => {
      const pClean = p.replace(/\\/g, '/');
      const parts = pClean.split('/');
      return parts.slice(0, -1).join('/');
    });

    const uniqueParentPaths = Array.from(new Set(parentPathsOfGroup));

    if (uniqueParentPaths.length <= 1) {
      paths.forEach((p) => {
        const pClean = p.replace(/\\/g, '/');
        titles[p] = pClean.split('/').pop() || p;
      });
      return;
    }

    const parentPathSuffixes: Record<string, string> = {};

    uniqueParentPaths.forEach((parentPath) => {
      const parts = parentPath.split('/');
      let depth = 1;
      let suffix = '';

      while (depth <= parts.length) {
        const candidate = parts.slice(-depth).join('/');
        const isUnique = uniqueParentPaths.every((otherPath) => {
          if (otherPath === parentPath) return true;
          const otherParts = otherPath.split('/');
          const otherCandidate = otherParts.slice(-depth).join('/');
          return candidate !== otherCandidate;
        });

        if (isUnique) {
          suffix = candidate;
          break;
        }
        depth++;
      }

      if (!suffix) {
        suffix = parentPath;
      }
      parentPathSuffixes[parentPath] = suffix;
    });

    paths.forEach((p) => {
      const pClean = p.replace(/\\/g, '/');
      const parts = pClean.split('/');
      const filename = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      const suffix = parentPathSuffixes[parentPath];

      if (suffix) {
        titles[p] = `${suffix}/${filename}`;
      } else {
        titles[p] = filename;
      }
    });
  });

  return titles;
};
