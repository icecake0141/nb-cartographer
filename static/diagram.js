export function initDiagram() {
        const boot = window.NB_CARTOGRAPHER_BOOT || {};
        const deviceElements = boot.deviceElements || [];
        const select = document.getElementById('componentSelect');
        const rackSelect = document.getElementById('rackSelect');
        const nodeTypeSelect = document.getElementById('nodeTypeSelect');
        const showServers = document.getElementById('showServers');
        const rackFolders = document.getElementById('rackFolders');
        const roleStats = document.getElementById('roleStats');
        const labelLevel = document.getElementById('labelLevel');
        const searchNode = document.getElementById('searchNode');
        const focusHops = document.getElementById('focusHops');
        const focusBtn = document.getElementById('focusBtn');
        const clearFocusBtn = document.getElementById('clearFocusBtn');
        const resetViewBtn = document.getElementById('resetViewBtn');
        const saveLayoutBtn = document.getElementById('saveLayoutBtn');
        const loadLayoutBtn = document.getElementById('loadLayoutBtn');
        const downloadSvgBtn = document.getElementById('downloadSvgBtn');
        const downloadDrawioLayoutBtn = document.getElementById('downloadDrawioLayoutBtn');
        const legendItems = document.getElementById('edgeLegendItems');
        const nodeLegendItems = document.getElementById('nodeLegendItems');
        const connectionsTable = document.getElementById('connectionsTable');
        let cy = null;
        let comps = [];
        let hiddenServerRacks = new Set();
        let hiddenCableTypes = new Set();
        let hiddenNodeRoles = new Set();
        let focusNodeIds = null;
        let selectedEdgePairKey = null;
        let selectedNodeId = null;
        if (!deviceElements.length || !select || !rackSelect || !legendItems || !nodeTypeSelect) return;

        function deviceStyle() {
          return [
            {
              selector: 'node.rack-group',
              style: {
                'shape': 'round-rectangle',
                'background-color': '#eef2ff',
                'border-width': 3,
                'border-color': '#a5b4fc',
                'label': 'data(label)',
                'font-size': 17,
                'text-valign': 'top',
                'text-halign': 'center',
                'padding': '48px',
                'color': '#1f2937',
              }
            },
            {
              selector: 'node.device-summary',
              style: {
                'shape': 'round-rectangle',
                'background-color': '#0f766e',
                'border-width': 3,
                'border-color': '#0b5f59',
                'color': '#ffffff',
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': 13,
                'text-wrap': 'wrap',
                'text-max-width': 180,
                'width': 148,
                'height': 54,
              }
            },
            {
              selector: 'node.device-summary[role = "core"]',
              style: {
                'background-color': '#1d4ed8',
                'border-color': '#1e40af',
              }
            },
            {
              selector: 'node.device-summary[role = "leaf"]',
              style: {
                'background-color': '#0f766e',
                'border-color': '#0b5f59',
              }
            },
            {
              selector: 'node.device-summary[role = "server"]',
              style: {
                'background-color': '#475569',
                'border-color': '#334155',
                'width': 118,
                'height': 46,
                'font-size': 12,
              }
            },
            {
              selector: 'node.device-summary[role = "powered_device"]',
              style: {
                'background-color': '#64748b',
                'border-color': '#475569',
                'width': 118,
                'height': 46,
                'font-size': 12,
              }
            },
            {
              selector: 'node.device-summary[role = "external"]',
              style: {
                'shape': 'hexagon',
                'background-color': '#1d4ed8',
                'border-color': '#1e3a8a',
                'width': 148,
                'height': 64,
              }
            },
            {
              selector: 'node.device-summary[role = "patch_panel"]',
              style: {
                'shape': 'round-rectangle',
                'background-color': '#a16207',
                'border-color': '#92400e',
                'width': 148,
                'height': 54,
              }
            },
            {
              selector: 'node.device-summary[role = "pdu"]',
              style: {
                'shape': 'rectangle',
                'background-color': '#ea580c',
                'border-color': '#c2410c',
                'width': 120,
                'height': 50,
              }
            },
            {
              selector: 'node.device-summary[role = "power_source"]',
              style: {
                'shape': 'diamond',
                'background-color': '#dc2626',
                'border-color': '#991b1b',
                'width': 126,
                'height': 56,
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 'mapData(count, 1, 8, 2, 6)',
                'line-color': 'data(color)',
                'curve-style': 'unbundled-bezier',
                'control-point-distances': 'data(curve_offset)',
                'control-point-weights': 0.5,
                'label': 'data(label)',
                'font-size': 12,
                'text-background-color': '#fff',
                'text-background-opacity': 0.9,
                'text-background-padding': 2,
              }
            },
            { selector: 'edge[domain = "power"]', style: { 'line-style': 'dashed', 'opacity': 0.9 } },
            { selector: 'edge[domain = "circuit"]', style: { 'line-style': 'dotted', 'width': 4 } },
            { selector: 'edge[domain = "pass_through"]', style: { 'line-style': 'solid', 'width': 3 } },
            { selector: '.filtered-out', style: { 'display': 'none' } },
            {
              selector: 'edge.connection-highlight',
              style: {
                'line-color': '#f59e0b',
                'width': 8,
                'z-index': 1000,
              }
            },
            {
              selector: 'node.connection-highlight',
              style: {
                'border-width': 6,
                'border-color': '#f59e0b',
                'z-index': 1000,
              }
            },
            {
              selector: 'node.connection-neighbor',
              style: {
                'border-width': 5,
                'border-color': '#f97316',
                'z-index': 950,
              }
            }
          ];
        }

        function degreeMap() {
          const d = new Map();
          cy.nodes('node.device-summary').forEach((n) => d.set(n.id(), n.connectedEdges().length));
          return d;
        }

        function quantile(values, q) {
          if (!values.length) return 0;
          const sorted = values.slice().sort((a, b) => a - b);
          const pos = (sorted.length - 1) * q;
          const base = Math.floor(pos);
          const rest = pos - base;
          const a = sorted[base];
          const b = sorted[Math.min(base + 1, sorted.length - 1)];
          return a + (b - a) * rest;
        }

        function classifyRoles() {
          const deg = degreeMap();
          const devices = cy.nodes('node.device-summary');
          const ids = devices.map((n) => n.id());
          const fixedHintRoles = new Set(['external', 'patch_panel', 'pdu', 'power_source', 'powered_device']);
          const fixedRoleById = new Map();

          ids.forEach((id) => {
            const node = cy.getElementById(id);
            const hint = node.data('role_hint');
            if (fixedHintRoles.has(hint)) {
              fixedRoleById.set(id, hint);
              node.data('role', hint);
            }
          });

          const candidates = ids.filter((id) => !fixedRoleById.has(id));
          const degrees = candidates.map((id) => deg.get(id) || 0);
          const lowTh = Math.max(1, Math.floor(quantile(degrees, 0.25)));
          const midTh = Math.max(lowTh + 1, Math.floor(quantile(degrees, 0.50)));
          const highTh = Math.max(midTh + 1, Math.ceil(quantile(degrees, 0.75)));

          const server = new Set();
          const leaf = new Set();
          const core = new Set();

          const neighbors = (id) => (
            cy.getElementById(id)
              .connectedEdges()
              .connectedNodes('node.device-summary')
              .map((n) => n.id())
              .filter((x) => x !== id)
          );

          const candidateNeighbors = (id) => neighbors(id).filter((n) => !fixedRoleById.has(n));
          const isServerLike = (id) => {
            if (server.has(id)) return true;
            if (fixedRoleById.get(id) === 'powered_device') return true;
            return cy.getElementById(id).data('role_hint') === 'powered_device';
          };
          const hasName = (id, regex) => regex.test((cy.getElementById(id).data('label') || '').toLowerCase());

          candidates.forEach((id) => {
            if (hasName(id, /(server|\-srv\d+|host|compute)/)) server.add(id);
            if (hasName(id, /(spine|core)/)) core.add(id);
            if (hasName(id, /(leaf|tor|edge)/)) leaf.add(id);
          });

          candidates.forEach((id) => {
            const d = deg.get(id) || 0;
            const ns = candidateNeighbors(id);
            const highNs = ns.filter((n) => (deg.get(n) || 0) >= highTh).length;
            const lowNs = ns.filter((n) => (deg.get(n) || 0) <= lowTh).length;
            if (d <= Math.max(2, lowTh) && highNs >= 1 && lowNs === 0) server.add(id);
          });

          candidates.forEach((id) => {
            if (server.has(id) || core.has(id)) return;
            const ns = neighbors(id);
            const serverNs = ns.filter((n) => isServerLike(n)).length;
            if (serverNs >= 2 || ((deg.get(id) || 0) >= midTh && serverNs >= 1)) leaf.add(id);
          });

          candidates.forEach((id) => {
            if (server.has(id) || core.has(id)) return;
            const ns = candidateNeighbors(id);
            const leafNs = ns.filter((n) => leaf.has(n)).length;
            const serverNs = ns.filter((n) => isServerLike(n)).length;
            if (leafNs >= 2 && serverNs === 0) core.add(id);
          });

          candidates.forEach((id) => {
            if (server.has(id) || core.has(id) || leaf.has(id)) return;
            const ns = neighbors(id);
            const serverNs = ns.filter((n) => isServerLike(n)).length;
            const coreNs = ns.filter((n) => core.has(n)).length;
            if (serverNs > 0) leaf.add(id);
            else if (coreNs > 0) leaf.add(id);
            else if ((deg.get(id) || 0) <= lowTh) server.add(id);
            else leaf.add(id);
          });

          if (core.size === 0) candidates.filter((id) => !server.has(id)).slice(0, 2).forEach((id) => core.add(id));
          if (leaf.size === 0) {
            candidates.filter((id) => !server.has(id)).slice(0, Math.max(2, Math.floor(candidates.length * 0.1))).forEach((id) => leaf.add(id));
          }
          if (server.size === 0) candidates.filter((id) => !core.has(id) && !leaf.has(id)).forEach((id) => server.add(id));

          candidates.forEach((id) => {
            if (server.has(id)) cy.getElementById(id).data('role', 'server');
            else if (core.has(id)) cy.getElementById(id).data('role', 'core');
            else cy.getElementById(id).data('role', 'leaf');
          });

          const counts = {};
          cy.nodes('node.device-summary').forEach((n) => {
            const role = n.data('role') || 'leaf';
            counts[role] = (counts[role] || 0) + 1;
          });
          roleStats.innerHTML = `
            <p>Core <strong>${counts.core || 0}</strong></p>
            <p>Leaf <strong>${counts.leaf || 0}</strong></p>
            <p>Server <strong>${counts.server || 0}</strong></p>
            <p>Powered Device <strong>${counts.powered_device || 0}</strong></p>
            <p>PDU <strong>${counts.pdu || 0}</strong></p>
            <p>Power Source <strong>${counts.power_source || 0}</strong></p>
            <p>Patch Panel <strong>${counts.patch_panel || 0}</strong></p>
            <p>External <strong>${counts.external || 0}</strong></p>
          `;
        }

        function spreadX(nodes, centerX, minGap) {
          const n = nodes.length;
          if (n === 0) return {};
          const positions = {};
          const start = centerX - ((n - 1) * minGap) / 2;
          nodes.forEach((node, i) => {
            positions[node.id()] = start + i * minGap;
          });
          return positions;
        }

        function fitVisibleWithMinZoom(elements, padding = 80, minZoom = 0.65) {
          if (!elements || elements.empty()) return;
          cy.fit(elements, padding);
          if (cy.zoom() < minZoom) {
            cy.zoom(minZoom);
            cy.center(elements);
          }
        }

        function applyHierarchicalLayout() {
          const width = Math.max(cy.width(), 4800);
          const roleNodes = {
            external: cy.nodes('node.device-summary[role = "external"]').toArray(),
            patch_panel: cy.nodes('node.device-summary[role = "patch_panel"]').toArray(),
            core: cy.nodes('node.device-summary[role = "core"]').toArray(),
            leaf: cy.nodes('node.device-summary[role = "leaf"]').toArray(),
            pdu: cy.nodes('node.device-summary[role = "pdu"]').toArray(),
            power_source: cy.nodes('node.device-summary[role = "power_source"]').toArray(),
            powered_device: cy.nodes('node.device-summary[role = "powered_device"]').toArray(),
            server: cy.nodes('node.device-summary[role = "server"]').toArray(),
          };
          const yMap = {
            external: 140,
            patch_panel: 360,
            core: 620,
            leaf: 900,
            pdu: 1200,
            power_source: 1200,
            powered_device: 1480,
            server: 1480,
          };
          const positions = {};
          const deg = degreeMap();
          const rackOrder = cy
            .nodes('node.rack-group')
            .map((n) => n.data('label') || 'UNASSIGNED')
            .sort((a, b) => String(a).localeCompare(String(b)));
          const rackCenterMap = new Map();
          const rackWidthMap = new Map();
          const rackMargin = 560;

          const roleGap = {
            external: 460,
            patch_panel: 420,
            core: 540,
            leaf: 430,
            power_source: 440,
            pdu: 420,
            powered_device: 360,
            server: 360,
          };
          const roleNodesMap = {
            external: roleNodes.external,
            patch_panel: roleNodes.patch_panel,
            core: roleNodes.core,
            leaf: roleNodes.leaf,
            power_source: roleNodes.power_source,
            pdu: roleNodes.pdu,
            powered_device: roleNodes.powered_device,
            server: roleNodes.server,
          };

          const countByRackRole = new Map();
          Object.entries(roleNodesMap).forEach(([role, nodes]) => {
            nodes.forEach((n) => {
              const rack = n.data('rack') || 'UNASSIGNED';
              const k = `${rack}::${role}`;
              countByRackRole.set(k, (countByRackRole.get(k) || 0) + 1);
            });
          });

          rackOrder.forEach((rack) => {
            let required = 520;
            Object.keys(roleNodesMap).forEach((role) => {
              const c = countByRackRole.get(`${rack}::${role}`) || 0;
              if (c > 1) required = Math.max(required, (c - 1) * roleGap[role] + 430);
              if (c === 1) required = Math.max(required, 420);
            });
            rackWidthMap.set(rack, required);
          });

          const totalWidth = rackOrder.reduce((acc, r) => acc + (rackWidthMap.get(r) || 520), 0) + rackMargin * Math.max(0, rackOrder.length - 1);
          let cursor = width / 2 - totalWidth / 2;
          rackOrder.forEach((rack) => {
            const w = rackWidthMap.get(rack) || 520;
            rackCenterMap.set(rack, cursor + w / 2);
            cursor += w + rackMargin;
          });
          const rackCenter = (rack) => rackCenterMap.get(rack) || width / 2;
          const rackWidth = (rack) => rackWidthMap.get(rack) || 520;

          roleNodes.external.sort((a, b) => (deg.get(b.id()) || 0) - (deg.get(a.id()) || 0));
          const externalX = spreadX(roleNodes.external, width / 2, 360);
          roleNodes.external.forEach((n) => { positions[n.id()] = { x: externalX[n.id()], y: yMap.external }; });

          const roleToTier = (role) => {
            if (role === 'external') return 'external';
            if (role === 'core') return 'core';
            if (role === 'leaf') return 'leaf';
            if (role === 'pdu' || role === 'power_source') return 'power';
            if (role === 'server' || role === 'powered_device') return 'access';
            return 'leaf';
          };
          const tierY = {
            external: yMap.external,
            core: yMap.core,
            leaf: yMap.leaf,
            power: yMap.pdu,
            access: yMap.server,
          };
          const tierRank = { external: 0, core: 1, leaf: 2, power: 3, access: 4 };
          const patchTierMeta = new Map();

          roleNodes.patch_panel.forEach((n) => {
            const rack = n.data('rack') || 'UNASSIGNED';
            const neighborRoles = n
              .connectedEdges()
              .connectedNodes('node.device-summary')
              .filter((m) => m.id() !== n.id())
              .map((m) => m.data('role') || 'leaf');
            const tiers = [...new Set(neighborRoles.map((r) => roleToTier(r)))].sort((a, b) => tierRank[a] - tierRank[b]);
            let bucket = 'leaf';
            let y = tierY.leaf;
            if (tiers.length === 1) {
              bucket = tiers[0];
              y = tierY[bucket];
            } else if (tiers.length >= 2) {
              const low = tiers[0];
              const high = tiers[tiers.length - 1];
              bucket = `${low}-${high}`;
              y = (tierY[low] + tierY[high]) / 2;
            }
            patchTierMeta.set(n.id(), { rack, bucket, y });
          });

          const byRackAndBucket = new Map();
          roleNodes.patch_panel.forEach((n) => {
            const meta = patchTierMeta.get(n.id()) || { rack: 'UNASSIGNED', bucket: 'leaf', y: tierY.leaf };
            const key = `${meta.rack}::${meta.bucket}`;
            if (!byRackAndBucket.has(key)) byRackAndBucket.set(key, { rack: meta.rack, y: meta.y, nodes: [] });
            byRackAndBucket.get(key).nodes.push(n);
          });

          for (const group of byRackAndBucket.values()) {
            group.nodes.sort((a, b) => (deg.get(b.id()) || 0) - (deg.get(a.id()) || 0));
            const xs = spreadX(group.nodes, rackCenter(group.rack), 360);
            group.nodes.forEach((n) => {
              positions[n.id()] = { x: xs[n.id()], y: group.y };
            });
          }

          roleNodes.core.sort((a, b) => {
            const rackCmp = String(a.data('rack') || '').localeCompare(String(b.data('rack') || ''));
            if (rackCmp !== 0) return rackCmp;
            return (deg.get(b.id()) || 0) - (deg.get(a.id()) || 0);
          });
          const byRackCore = new Map();
          roleNodes.core.forEach((n) => {
            const rack = n.data('rack') || 'UNASSIGNED';
            if (!byRackCore.has(rack)) byRackCore.set(rack, []);
            byRackCore.get(rack).push(n);
          });
          for (const [rack, nodes] of byRackCore.entries()) {
            const gap = Math.max(360, Math.floor((rackWidth(rack) - 220) / Math.max(1, nodes.length)));
            const xs = spreadX(nodes, rackCenter(rack), gap);
            nodes.forEach((n) => { positions[n.id()] = { x: xs[n.id()], y: yMap.core }; });
          }

          roleNodes.leaf.sort((a, b) => {
            const rackCmp = String(a.data('rack') || '').localeCompare(String(b.data('rack') || ''));
            if (rackCmp !== 0) return rackCmp;
            return (deg.get(b.id()) || 0) - (deg.get(a.id()) || 0);
          });
          const byRackLeaf = new Map();
          roleNodes.leaf.forEach((n) => {
            const r = n.data('rack') || 'UNASSIGNED';
            if (!byRackLeaf.has(r)) byRackLeaf.set(r, []);
            byRackLeaf.get(r).push(n);
          });
          for (const [r, nodes] of byRackLeaf.entries()) {
            const gap = Math.max(320, Math.floor((rackWidth(r) - 240) / Math.max(1, nodes.length)));
            const xs = spreadX(nodes, rackCenter(r), gap);
            nodes.forEach((n) => { positions[n.id()] = { x: xs[n.id()], y: yMap.leaf }; });
          }

          const byRackLeafCenter = new Map();
          roleNodes.leaf.forEach((n) => {
            const rack = n.data('rack') || 'UNASSIGNED';
            if (!byRackLeafCenter.has(rack)) byRackLeafCenter.set(rack, []);
            byRackLeafCenter.get(rack).push(positions[n.id()]?.x || rackCenter(rack));
          });
          const leafCenter = (rack) => {
            const xs = byRackLeafCenter.get(rack) || [];
            if (!xs.length) return rackCenter(rack);
            return xs.reduce((a, b) => a + b, 0) / xs.length;
          };
          const placeByRack = (nodes, roleName, gap) => {
            nodes.sort((a, b) => String(a.data('rack') || '').localeCompare(String(b.data('rack') || '')));
            const byRack = new Map();
            nodes.forEach((n) => {
              const rack = n.data('rack') || 'UNASSIGNED';
              if (!byRack.has(rack)) byRack.set(rack, []);
              byRack.get(rack).push(n);
            });
            for (const [rack, rackNodes] of byRack.entries()) {
              const dynGap = Math.max(Math.floor(gap * 0.85), Math.floor((rackWidth(rack) - 220) / Math.max(1, rackNodes.length)));
              const xs = spreadX(rackNodes, leafCenter(rack), dynGap);
              const center = rackCenter(rack);
              const half = Math.max(180, (rackWidth(rack) - 140) / 2);
              rackNodes.forEach((n) => {
                const clampedX = Math.max(center - half, Math.min(center + half, xs[n.id()]));
                positions[n.id()] = { x: clampedX, y: yMap[roleName] };
              });
            }
          };

          placeByRack(roleNodes.power_source, "power_source", 420);
          placeByRack(roleNodes.pdu, "pdu", 400);
          placeByRack(roleNodes.powered_device, "powered_device", 340);
          placeByRack(roleNodes.server, "server", 340);

          cy.layout({
            name: 'preset',
            positions: (node) => positions[node.id()] || node.position(),
            animate: false,
            fit: false,
            padding: 80,
          }).run();

          // Fine collision avoidance within the same horizontal band.
          ['external', 'patch_panel', 'core', 'leaf', 'power_source', 'pdu', 'powered_device', 'server'].forEach((role) => {
            const grouped = new Map();
            cy.nodes(`node.device-summary[role = "${role}"]`).forEach((n) => {
              const bucket = role === 'external' ? '__global__' : (n.data('rack') || 'UNASSIGNED');
              if (!grouped.has(bucket)) grouped.set(bucket, []);
              grouped.get(bucket).push(n);
            });
            const minGap = role === 'server' || role === 'powered_device' ? 320 : 420;
            for (const nodes of grouped.values()) {
              nodes.sort((a, b) => a.position('x') - b.position('x'));
              for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const cur = nodes[i];
                const dx = cur.position('x') - prev.position('x');
                if (dx < minGap) cur.position('x', prev.position('x') + minGap);
              }
            }
          });
          fitVisibleWithMinZoom(cy.elements(':visible'), 80, 0.68);
          assignEdgeCurves();
        }

        function applyReadableSpacing() {
          const visibleDevices = cy.nodes('node.device-summary:visible');
          const count = visibleDevices.length;
          if (!count) return;
          const densityFactor = count <= 24 ? 1.8 : count <= 48 ? 1.4 : 1.0;
          ['external', 'patch_panel', 'core', 'leaf', 'power_source', 'pdu', 'powered_device', 'server'].forEach((role) => {
            const grouped = new Map();
            cy.nodes(`node.device-summary[role = "${role}"]:visible`).forEach((n) => {
              const bucket = role === 'external' ? '__global__' : (n.data('rack') || 'UNASSIGNED');
              if (!grouped.has(bucket)) grouped.set(bucket, []);
              grouped.get(bucket).push(n);
            });
            const baseGap = role === 'server' || role === 'powered_device' ? 320 : 420;
            const minGap = Math.floor(baseGap * densityFactor);
            for (const nodes of grouped.values()) {
              nodes.sort((a, b) => a.position('x') - b.position('x'));
              for (let i = 1; i < nodes.length; i++) {
                const prev = nodes[i - 1];
                const cur = nodes[i];
                const dx = cur.position('x') - prev.position('x');
                if (dx < minGap) cur.position('x', prev.position('x') + minGap);
              }
            }
          });
          assignEdgeCurves();
        }

        function assignEdgeCurves() {
          const grouped = new Map();
          cy.edges(':visible').forEach((e) => {
            const s = e.source().id();
            const t = e.target().id();
            const key = s < t ? `${s}||${t}` : `${t}||${s}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(e);
          });
          grouped.forEach((edges) => {
            if (edges.length === 1) {
              edges[0].data('curve_offset', 0);
              return;
            }
            const step = 26;
            edges.forEach((e, i) => {
              const n = Math.floor(i / 2) + 1;
              const sign = i % 2 === 0 ? 1 : -1;
              e.data('curve_offset', n * step * sign);
            });
          });
        }

        function buildComponents() {
          comps = cy.elements('node.device-summary, edge').components();
          comps.sort((a, b) => b.nodes().length - a.nodes().length);
        }

        function fillSelector() {
          select.innerHTML = '';
          const allOpt = document.createElement('option');
          allOpt.value = 'all';
          allOpt.textContent = `Show All (${comps.length} components)`;
          select.appendChild(allOpt);
          comps.forEach((comp, i) => {
            const o = document.createElement('option');
            o.value = String(i);
            o.textContent = `Component ${i + 1} (dev:${comp.nodes().length}, edge:${comp.edges().length})`;
            select.appendChild(o);
          });
        }

        function componentKeep(value) {
          if (value === 'all') return cy.elements();
          const idx = Number(value);
          const comp = comps[idx];
          if (!comp) return cy.collection();
          return comp;
        }

        function rackKeep(value) {
          if (value === 'all') return cy.elements();
          const rackDevices = cy.nodes('node.device-summary').filter((n) => (n.data('rack') || '') === value);
          if (rackDevices.empty()) return cy.collection();
          const rackEdges = rackDevices.connectedEdges();
          const peerDevices = rackEdges.connectedNodes('node.device-summary');
          return rackDevices.union(rackEdges).union(peerDevices);
        }

        function nodeTypeKeep(value) {
          const all = cy.elements();
          const hiddenNodes = cy.nodes('node.device-summary').filter((n) => hiddenNodeRoles.has(n.data('role') || ''));
          const visibleByLegend = all.difference(hiddenNodes).difference(hiddenNodes.connectedEdges());
          if (value === 'all') return visibleByLegend;
          const selectedNodes = cy.nodes(`node.device-summary[role = "${value}"]`);
          if (selectedNodes.empty()) return cy.collection();
          const selectedEdges = selectedNodes.connectedEdges();
          const peers = selectedEdges.connectedNodes('node.device-summary');
          return selectedNodes.union(selectedEdges).union(peers).intersection(visibleByLegend);
        }

        function serverKeep() {
          const all = cy.elements();
          const serverNodes = cy.nodes('node.device-summary[role = "server"]');
          if (showServers.checked) {
            if (hiddenServerRacks.size === 0) return all;
            const hidden = serverNodes.filter((n) => hiddenServerRacks.has(n.data('rack') || ''));
            return all.difference(hidden);
          }
          return all.difference(serverNodes);
        }

        function cableTypeKeep() {
          if (hiddenCableTypes.size === 0) return cy.elements();
          const hiddenEdges = cy.edges().filter((e) => hiddenCableTypes.has(e.data('cable_type') || ''));
          return cy.elements().difference(hiddenEdges);
        }

        function focusKeep() {
          if (!focusNodeIds || focusNodeIds.size === 0) return cy.elements();
          const nodes = cy.nodes('node.device-summary').filter((n) => focusNodeIds.has(n.id()));
          const edges = nodes.connectedEdges();
          return nodes.union(edges);
        }

        function applyLabelLevel(level) {
          if (level === 'minimal') {
            cy.style().selector('node.device-summary').style('label', '').selector('edge').style('label', '').update();
            return;
          }
          if (level === 'detailed') {
            cy.style()
              .selector('node.device-summary')
              .style('label', (ele) => `${ele.data('label')} (${ele.connectedEdges().length})`)
              .selector('edge')
              .style('label', 'data(label)')
              .update();
            return;
          }
          cy.style().selector('node.device-summary').style('label', 'data(label)').selector('edge').style('label', 'data(label)').update();
        }

        function makeLayoutStorageKey() {
          const resultId = String(boot.resultId || 'latest');
          return `nb-cartographer-layout-v3-${resultId}`;
        }

        function makeLegacyLayoutStorageKey() {
          const resultId = String(boot.resultId || 'latest');
          return `nb-diagram-layout-v3-${resultId}`;
        }

        function saveLayoutToStorage() {
          const positions = {};
          cy.nodes('node.device-summary').forEach((n) => {
            positions[n.id()] = n.position();
          });
          localStorage.setItem(makeLayoutStorageKey(), JSON.stringify(positions));
        }

        function loadLayoutFromStorage() {
          const newKey = makeLayoutStorageKey();
          const legacyKey = makeLegacyLayoutStorageKey();
          const raw = localStorage.getItem(newKey) || localStorage.getItem(legacyKey);
          if (!raw) return false;
          try {
            const positions = JSON.parse(raw);
            if (!localStorage.getItem(newKey) && localStorage.getItem(legacyKey)) {
              localStorage.setItem(newKey, raw);
            }
            cy.layout({
              name: 'preset',
              positions: (node) => positions[node.id()] || node.position(),
              animate: false,
              fit: false,
              padding: 34,
            }).run();
            fitVisibleWithMinZoom(cy.elements(':visible'), 34, 0.68);
            return true;
          } catch (_) {
            return false;
          }
        }

        function buildFocusIdsByQuery(query, hops) {
          const q = query.trim().toLowerCase();
          if (!q) return null;
          const starts = cy.nodes('node.device-summary').filter((n) => (n.data('label') || '').toLowerCase().includes(q));
          if (starts.empty()) return new Set();
          const visited = new Set(starts.map((n) => n.id()));
          let frontier = starts;
          for (let step = 0; step < hops; step++) {
            const next = frontier.connectedEdges().connectedNodes('node.device-summary');
            next.forEach((n) => visited.add(n.id()));
            frontier = next;
          }
          return visited;
        }

        function buildRackFolders() {
          const racks = [
            ...new Set(
              cy.nodes('node.device-summary[role = "server"]')
                .map((n) => n.data('rack') || 'UNASSIGNED')
            )
          ].sort();
          rackFolders.innerHTML = '';
          racks.forEach((rack) => {
            const id = `rack-folder-${rack.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const row = document.createElement('label');
            row.className = 'rack-folder-row';
            row.innerHTML = `<input type="checkbox" id="${id}" checked> ${rack}`;
            const box = row.querySelector('input');
            box.addEventListener('change', () => {
              if (box.checked) hiddenServerRacks.delete(rack);
              else hiddenServerRacks.add(rack);
              applyFilters();
            });
            rackFolders.appendChild(row);
          });
        }

        function edgePairKeyByDevices(aDevice, bDevice) {
          const a = `dev::${aDevice || ''}`;
          const b = `dev::${bDevice || ''}`;
          return a <= b ? `${a}||${b}` : `${b}||${a}`;
        }

        function edgePairKey(edge) {
          const a = edge.data('source') || '';
          const b = edge.data('target') || '';
          return a <= b ? `${a}||${b}` : `${b}||${a}`;
        }

        function rowMatchesSelection(row) {
          if (selectedEdgePairKey) {
            const rowPair = edgePairKeyByDevices(row.dataset.aDevice, row.dataset.bDevice);
            return rowPair === selectedEdgePairKey;
          }
          if (selectedNodeId) {
            const rowA = `dev::${row.dataset.aDevice || ''}`;
            const rowB = `dev::${row.dataset.bDevice || ''}`;
            return rowA === selectedNodeId || rowB === selectedNodeId;
          }
          return false;
        }

        function applyConnectionSelection() {
          cy.elements().removeClass('connection-highlight connection-neighbor');
          if (!selectedEdgePairKey && !selectedNodeId) {
            if (connectionsTable) {
              connectionsTable.querySelectorAll('tbody tr').forEach((row) => row.classList.remove('is-selected'));
            }
            return;
          }
          if (selectedEdgePairKey) {
            const edges = cy.edges().filter((e) => edgePairKey(e) === selectedEdgePairKey);
            edges.addClass('connection-highlight');
            edges.connectedNodes('node.device-summary').addClass('connection-highlight');
          }
          if (selectedNodeId) {
            const node = cy.getElementById(selectedNodeId);
            if (node.nonempty()) {
              node.addClass('connection-highlight');
              node.connectedEdges().addClass('connection-highlight');
              node.connectedEdges().connectedNodes('node.device-summary').difference(node).addClass('connection-neighbor');
            }
          }
          if (connectionsTable) {
            connectionsTable.querySelectorAll('tbody tr').forEach((row) => {
              row.classList.toggle('is-selected', rowMatchesSelection(row));
            });
          }
        }

        function buildNodeTypeControls() {
          const roleOrder = ['core', 'leaf', 'server', 'powered_device', 'pdu', 'power_source', 'patch_panel', 'external'];
          const counts = {};
          cy.nodes('node.device-summary').forEach((n) => {
            const role = n.data('role') || 'leaf';
            counts[role] = (counts[role] || 0) + 1;
          });

          nodeTypeSelect.innerHTML = '';
          const allOpt = document.createElement('option');
          allOpt.value = 'all';
          allOpt.textContent = 'All Node Types';
          nodeTypeSelect.appendChild(allOpt);
          roleOrder.forEach((role) => {
            if (!counts[role]) return;
            const opt = document.createElement('option');
            opt.value = role;
            opt.textContent = `${role} (${counts[role]})`;
            nodeTypeSelect.appendChild(opt);
          });

          if (!nodeLegendItems) return;
          nodeLegendItems.innerHTML = '';
          roleOrder.forEach((role) => {
            if (!counts[role]) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'legend-item';
            btn.dataset.nodeRole = role;
            btn.textContent = `${role} (${counts[role]})`;
            btn.addEventListener('click', () => {
              if (hiddenNodeRoles.has(role)) {
                hiddenNodeRoles.delete(role);
                btn.classList.remove('inactive');
              } else {
                hiddenNodeRoles.add(role);
                btn.classList.add('inactive');
                if (nodeTypeSelect.value === role) nodeTypeSelect.value = 'all';
              }
              applyFilters();
            });
            nodeLegendItems.appendChild(btn);
          });
        }

        function buildLayoutPositionsPayload() {
          const positions = {};
          cy.nodes('node.device-summary').forEach((n) => {
            positions[n.id()] = n.position();
          });
          return positions;
        }

        function triggerBlobDownload(blob, filename) {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function downloadCurrentSvg() {
          if (typeof cy.svg !== 'function') {
            window.alert('SVG export plugin is unavailable in this browser session.');
            return;
          }
          const svg = cy.svg({ full: true, scale: 1, bg: '#f8fafc' });
          const resultId = String(boot.resultId || 'latest');
          const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          triggerBlobDownload(blob, `result-${resultId}-layout.svg`);
        }

        async function downloadDrawioWithCurrentLayout() {
          const resultId = String(boot.resultId || '').trim();
          if (!/^\d+$/.test(resultId)) {
            window.alert('Current result ID is not available for drawio export.');
            return;
          }
          const payload = { positions: buildLayoutPositionsPayload() };
          const resp = await fetch(`/api/results/${resultId}/drawio-layout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || 'drawio export failed');
          }
          const blob = await resp.blob();
          triggerBlobDownload(blob, `result-${resultId}-layout.drawio`);
        }

        function setupConnectionTableInteractions() {
          if (!connectionsTable) return;
          const headerCells = [...connectionsTable.querySelectorAll('thead tr:first-child th')];
          if (!headerCells.length) return;
          const filterRow = document.createElement('tr');
          filterRow.className = 'connection-filter-row';
          headerCells.forEach((_, idx) => {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.colIndex = String(idx);
            input.placeholder = 'filter';
            input.className = 'connection-filter-input';
            input.addEventListener('input', () => {
              const filters = [...connectionsTable.querySelectorAll('.connection-filter-input')];
              const rows = [...connectionsTable.querySelectorAll('tbody tr')];
              rows.forEach((row) => {
                const match = filters.every((f) => {
                  const colIdx = Number(f.dataset.colIndex || '0');
                  const q = (f.value || '').trim().toLowerCase();
                  if (!q) return true;
                  const cell = row.cells[colIdx];
                  if (!cell) return false;
                  return (cell.textContent || '').toLowerCase().includes(q);
                });
                row.classList.toggle('row-hidden', !match);
              });
            });
            th.appendChild(input);
            filterRow.appendChild(th);
          });
          const thead = connectionsTable.querySelector('thead');
          thead.appendChild(filterRow);

          connectionsTable.querySelectorAll('tbody tr').forEach((row) => {
            row.addEventListener('click', () => {
              const key = edgePairKeyByDevices(row.dataset.aDevice, row.dataset.bDevice);
              if (selectedEdgePairKey === key && !selectedNodeId) {
                selectedEdgePairKey = null;
              } else {
                selectedEdgePairKey = key;
                selectedNodeId = null;
              }
              applyConnectionSelection();
            });
          });
        }

        function applyFilters() {
          cy.elements().removeClass('filtered-out');
          const byComp = componentKeep(select.value);
          const byRack = rackKeep(rackSelect.value);
          const byNodeType = nodeTypeKeep(nodeTypeSelect.value);
          const byServer = serverKeep();
          const byCable = cableTypeKeep();
          const byFocus = focusKeep();
          const keepBase = byComp.intersection(byRack).intersection(byNodeType).intersection(byServer).intersection(byCable).intersection(byFocus);
          const keep = keepBase.union(keepBase.parents());
          cy.elements().difference(keep).addClass('filtered-out');
          if (!keep.empty()) {
            applyReadableSpacing();
            fitVisibleWithMinZoom(keep, 34, 0.68);
          }
          applyConnectionSelection();
        }

        if (window.cytoscape && typeof window.cytoscape.use === 'function') {
          const svgPlugin = window.cytoscapeSvg || window['cytoscape-svg'];
          if (svgPlugin) window.cytoscape.use(svgPlugin);
        }

        cy = cytoscape({
          container: document.getElementById('cy'),
          elements: deviceElements,
          style: deviceStyle(),
          layout: {
            name: 'cose',
            animate: false,
            nodeRepulsion: 120000,
            idealEdgeLength: 140,
            padding: 30,
            numIter: 800,
          }
        });

        classifyRoles();
        applyHierarchicalLayout();
        loadLayoutFromStorage();
        buildComponents();
        buildRackFolders();
        buildNodeTypeControls();
        setupConnectionTableInteractions();
        fillSelector();
        showServers.checked = false;
        nodeTypeSelect.value = 'all';
        applyLabelLevel('standard');
        if (comps.length > 1) {
          select.value = '0';
          applyFilters();
        } else {
          select.value = 'all';
          applyFilters();
        }
        select.addEventListener('change', applyFilters);
        rackSelect.addEventListener('change', applyFilters);
        nodeTypeSelect.addEventListener('change', applyFilters);
        showServers.addEventListener('change', applyFilters);
        labelLevel.addEventListener('change', () => applyLabelLevel(labelLevel.value));
        focusBtn.addEventListener('click', () => {
          const hops = Number(focusHops.value || '1');
          focusNodeIds = buildFocusIdsByQuery(searchNode.value, hops);
          applyFilters();
        });
        clearFocusBtn.addEventListener('click', () => {
          focusNodeIds = null;
          searchNode.value = '';
          applyFilters();
        });
        resetViewBtn.addEventListener('click', () => {
          applyHierarchicalLayout();
          applyFilters();
        });
        saveLayoutBtn.addEventListener('click', () => {
          saveLayoutToStorage();
        });
        loadLayoutBtn.addEventListener('click', () => {
          if (loadLayoutFromStorage()) applyFilters();
        });
        if (downloadSvgBtn) {
          downloadSvgBtn.addEventListener('click', () => {
            downloadCurrentSvg();
          });
        }
        if (downloadDrawioLayoutBtn) {
          downloadDrawioLayoutBtn.addEventListener('click', async () => {
            try {
              await downloadDrawioWithCurrentLayout();
            } catch (err) {
              window.alert(`drawio export failed: ${String(err)}`);
            }
          });
        }
        legendItems.querySelectorAll('.legend-item').forEach((btn) => {
          btn.addEventListener('click', () => {
            const t = btn.dataset.cableType || '';
            if (hiddenCableTypes.has(t)) {
              hiddenCableTypes.delete(t);
              btn.classList.remove('inactive');
            } else {
              hiddenCableTypes.add(t);
              btn.classList.add('inactive');
            }
            applyFilters();
          });
        });
        cy.on('tap', 'edge', (evt) => {
          selectedEdgePairKey = edgePairKey(evt.target);
          selectedNodeId = null;
          applyConnectionSelection();
        });
        cy.on('tap', 'node.device-summary', (evt) => {
          selectedNodeId = evt.target.id();
          selectedEdgePairKey = null;
          applyConnectionSelection();
        });
        cy.on('tap', (evt) => {
          if (evt.target === cy) {
            selectedNodeId = null;
            selectedEdgePairKey = null;
            applyConnectionSelection();
          }
        });

}
