-- Database migration v7 for ZetaCP
-- Populate default competitive programming snippets

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('segtree', 'Segment Tree (Point Update, Range Query)', 'template <typename ${1:T} = int>
class SegmentTree {
    int n;
    std::vector<${1:T}> tree;
    ${1:T} neutral;

    ${1:T} merge(${1:T} a, ${1:T} b) {
        return ${2:a + b};
    }

public:
    SegmentTree(int n, ${1:T} neutral = ${1:T}()) : n(n), tree(4 * n, neutral), neutral(neutral) {}

    SegmentTree(const std::vector<${1:T}>& arr, ${1:T} neutral = ${1:T}()) : n(arr.size()), tree(4 * arr.size(), neutral), neutral(neutral) {
        build(arr, 1, 0, n - 1);
    }

    void build(const std::vector<${1:T}>& arr, int node, int start, int end) {
        if (start == end) {
            tree[node] = arr[start];
            return;
        }
        int mid = (start + end) / 2;
        build(arr, 2 * node, start, mid);
        build(arr, 2 * node + 1, mid + 1, end);
        tree[node] = merge(tree[2 * node], tree[2 * node + 1]);
    }

    void update(int node, int start, int end, int idx, ${1:T} val) {
        if (start == end) {
            tree[node] = val;
            return;
        }
        int mid = (start + end) / 2;
        if (idx <= mid) {
            update(2 * node, start, mid, idx, val);
        } else {
            update(2 * node + 1, mid + 1, end, idx, val);
        }
        tree[node] = merge(tree[2 * node], tree[2 * node + 1]);
    }

    void update(int idx, ${1:T} val) {
        update(1, 0, n - 1, idx, val);
    }

    ${1:T} query(int node, int start, int end, int l, int r) {
        if (r < start || end < l) return neutral;
        if (l <= start && end <= r) return tree[node];
        int mid = (start + end) / 2;
        return merge(query(2 * node, start, mid, l, r),
                     query(2 * node + 1, mid + 1, end, l, r));
    }

    ${1:T} query(int l, int r) {
        return query(1, 0, n - 1, l, r);
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('fenwick', 'Fenwick Tree (Binary Indexed Tree) for prefix sums', 'template <typename ${1:T} = int>
class FenwickTree {
    int n;
    std::vector<${1:T}> tree;

public:
    FenwickTree(int n) : n(n), tree(n + 1, 0) {}

    void add(int idx, ${1:T} delta) {
        for (; idx <= n; idx += idx & -idx) {
            tree[idx] += delta;
        }
    }

    ${1:T} query(int idx) {
        ${1:T} sum = 0;
        for (; idx > 0; idx -= idx & -idx) {
            sum += tree[idx];
        }
        return sum;
    }

    ${1:T} query(int l, int r) {
        if (l > r) return 0;
        return query(r) - query(l - 1);
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('dsu', 'Disjoint Set Union (Union-Find) with path compression', 'class DSU {
    std::vector<int> parent;
    std::vector<int> sz;

public:
    DSU(int n) {
        parent.resize(n);
        std::iota(parent.begin(), parent.end(), 0);
        sz.assign(n, 1);
    }

    int find(int i) {
        if (parent[i] == i)
            return i;
        return parent[i] = find(parent[i]);
    }

    bool unite(int i, int j) {
        int root_i = find(i);
        int root_j = find(j);
        if (root_i != root_j) {
            if (sz[root_i] < sz[root_j])
                std::swap(root_i, root_j);
            parent[root_j] = root_i;
            sz[root_i] += sz[root_j];
            return true;
        }
        return false;
    }

    int size(int i) {
        return sz[find(i)];
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('sparsetable', 'Sparse Table for constant-time Range Minimum Query', 'template <typename ${1:T} = int>
class SparseTable {
    int n;
    int K;
    std::vector<std::vector<${1:T}>> st;
    std::vector<int> lg;

public:
    SparseTable(const std::vector<${1:T}>& arr) {
        n = arr.size();
        lg.resize(n + 1);
        lg[1] = 0;
        for (int i = 2; i <= n; i++) {
            lg[i] = lg[i / 2] + 1;
        }
        K = lg[n] + 1;
        st.assign(n, std::vector<${1:T}>(K));
        for (int i = 0; i < n; i++) {
            st[i][0] = arr[i];
        }
        for (int j = 1; j < K; j++) {
            for (int i = 0; i + (1 << j) <= n; i++) {
                st[i][j] = ${2:std::min}(st[i][j - 1], st[i + (1 << (j - 1))][j - 1]);
            }
        }
    }

    ${1:T} query(int L, int R) {
        int j = lg[R - L + 1];
        return ${2:std::min}(st[L][j], st[R - (1 << j) + 1][j]);
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('trie', 'Trie (Prefix Tree) for lowercase alphabets', 'class Trie {
    struct TrieNode {
        std::vector<std::unique_ptr<TrieNode>> children;
        bool is_end_of_word;
        TrieNode() : children(${1:26}), is_end_of_word(false) {}
    };

    std::unique_ptr<TrieNode> root;

public:
    Trie() : root(std::make_unique<TrieNode>()) {}

    void insert(const std::string& word) {
        TrieNode* curr = root.get();
        for (char ch : word) {
            int idx = ch - ''${2:a}'';
            if (!curr->children[idx]) {
                curr->children[idx] = std::make_unique<TrieNode>();
            }
            curr = curr->children[idx].get();
        }
        curr->is_end_of_word = true;
    }

    bool search(const std::string& word) {
        TrieNode* curr = root.get();
        for (char ch : word) {
            int idx = ch - ''${2:a}'';
            if (!curr->children[idx]) return false;
            curr = curr->children[idx].get();
        }
        return curr->is_end_of_word;
    }

    bool startsWith(const std::string& prefix) {
        TrieNode* curr = root.get();
        for (char ch : prefix) {
            int idx = ch - ''${2:a}'';
            if (!curr->children[idx]) return false;
            curr = curr->children[idx].get();
        }
        return true;
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('hld', 'Heavy-Light Decomposition for trees', 'class HLD {
    int n;
    int timer;
    std::vector<std::vector<int>> adj;
    std::vector<int> parent, depth, heavy, head, pos;

    int dfs(int v) {
        int size = 1;
        int max_c_size = 0;
        for (int c : adj[v]) {
            if (c != parent[v]) {
                parent[c] = v;
                depth[c] = depth[v] + 1;
                int c_size = dfs(c);
                size += c_size;
                if (c_size > max_c_size) {
                    max_c_size = c_size;
                    heavy[v] = c;
                }
            }
        }
        return size;
    }

    void decompose(int v, int h) {
        head[v] = h;
        pos[v] = ++timer;
        if (heavy[v] != -1) {
            decompose(heavy[v], h);
        }
        for (int c : adj[v]) {
            if (c != parent[v] && c != heavy[v]) {
                decompose(c, c);
            }
        }
    }

public:
    HLD(int n) : n(n), timer(0), adj(n + 1), parent(n + 1), depth(n + 1), heavy(n + 1, -1), head(n + 1), pos(n + 1) {}

    void add_edge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);
    }

    void init(int root = ${1:1}) {
        parent[root] = root;
        depth[root] = 0;
        dfs(root);
        decompose(root, root);
    }

    int lca(int u, int v) {
        for (; head[u] != head[v]; v = parent[head[v]]) {
            if (depth[head[u]] > depth[head[v]]) {
                std::swap(u, v);
            }
        }
        if (depth[u] > depth[v]) {
            std::swap(u, v);
        }
        return u;
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('bfs', 'Breadth-First Search (BFS) on graphs', 'void bfs(int start, const std::vector<std::vector<int>>& adj, std::vector<bool>& visited) {
    std::queue<int> q;
    q.push(start);
    visited[start] = true;

    while (!q.empty()) {
        int u = q.front();
        q.pop();

        for (int v : adj[u]) {
            if (!visited[v]) {
                visited[v] = true;
                q.push(v);
            }
        }
    }
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('dfs', 'Depth-First Search (DFS) on graphs', 'void dfs(int u, const std::vector<std::vector<int>>& adj, std::vector<bool>& visited) {
    visited[u] = true;
    for (int v : adj[u]) {
        if (!visited[v]) {
            dfs(v, adj, visited);
        }
    }
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('dijkstra', 'Dijkstra''s Shortest Path algorithm using priority queue', 'const long long INF = 1e18;

struct Edge {
    int to;
    long long weight;
};

std::vector<long long> dijkstra(int start, int n, const std::vector<std::vector<Edge>>& adj) {
    std::vector<long long> dist(n, INF);
    using pii = std::pair<long long, int>;
    std::priority_queue<pii, std::vector<pii>, std::greater<pii>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();

        if (d > dist[u]) continue;

        for (auto& edge : adj[u]) {
            if (dist[u] + edge.weight < dist[edge.to]) {
                dist[edge.to] = dist[u] + edge.weight;
                pq.push({dist[edge.to], edge.to});
            }
        }
    }
    return dist;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('bellmanford', 'Bellman-Ford shortest path algorithm with negative weights', 'const long long INF = 1e18;

struct Edge {
    int from, to;
    long long weight;
};

bool bellman_ford(int start, int n, const std::vector<Edge>& edges, std::vector<long long>& dist) {
    dist.assign(n, INF);
    dist[start] = 0;
    for (int i = 0; i < n - 1; i++) {
        for (const auto& edge : edges) {
            if (dist[edge.from] < INF && dist[edge.from] + edge.weight < dist[edge.to]) {
                dist[edge.to] = dist[edge.from] + edge.weight;
            }
        }
    }
    for (const auto& edge : edges) {
        if (dist[edge.from] < INF && dist[edge.from] + edge.weight < dist[edge.to]) {
            return true;
        }
    }
    return false;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('floyd', 'Floyd-Warshall all-pairs shortest paths algorithm', 'const long long INF = 1e18;

void floyd_warshall(int n, std::vector<std::vector<long long>>& dist) {
    for (int k = 0; k < n; k++) {
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n; j++) {
                if (dist[i][k] < INF && dist[k][j] < INF) {
                    dist[i][j] = std::min(dist[i][j], dist[i][k] + dist[k][j]);
                }
            }
        }
    }
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('kruskal', 'Kruskal''s Minimum Spanning Tree algorithm', 'struct Edge {
    int u, v;
    long long weight;
    bool operator<(const Edge& other) const {
        return weight < other.weight;
    }
};

struct DSU {
    std::vector<int> parent;
    DSU(int n) {
        parent.resize(n);
        std::iota(parent.begin(), parent.end(), 0);
    }
    int find(int i) {
        return parent[i] == i ? i : parent[i] = find(parent[i]);
    }
    bool unite(int i, int j) {
        int root_i = find(i);
        int root_j = find(j);
        if (root_i != root_j) {
            parent[root_j] = root_i;
            return true;
        }
        return false;
    }
};

std::vector<Edge> kruskal(int n, std::vector<Edge>& edges, long long& mst_weight) {
    std::sort(edges.begin(), edges.end());
    DSU dsu(n);
    std::vector<Edge> mst;
    mst_weight = 0;
    for (const auto& edge : edges) {
        if (dsu.unite(edge.u, edge.v)) {
            mst.push_back(edge);
            mst_weight += edge.weight;
        }
    }
    return mst;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('prim', 'Prim''s Minimum Spanning Tree algorithm using priority queue', 'const long long INF = 1e18;

struct Edge {
    int to;
    long long weight;
};

long long prim(int n, const std::vector<std::vector<Edge>>& adj) {
    std::vector<bool> in_mst(n, false);
    std::vector<long long> min_e(n, INF);
    using pii = std::pair<long long, int>;
    std::priority_queue<pii, std::vector<pii>, std::greater<pii>> pq;

    long long mst_weight = 0;
    min_e[0] = 0;
    pq.push({0, 0});

    while (!pq.empty()) {
        auto [w, u] = pq.top();
        pq.pop();

        if (in_mst[u]) continue;
        in_mst[u] = true;
        mst_weight += w;

        for (auto& edge : adj[u]) {
            if (!in_mst[edge.to] && edge.weight < min_e[edge.to]) {
                min_e[edge.to] = edge.weight;
                pq.push({min_e[edge.to], edge.to});
            }
        }
    }
    return mst_weight;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('tarjan', 'Tarjan''s Strongly Connected Components (SCC) algorithm', 'class TarjanSCC {
    int n;
    std::vector<std::vector<int>> adj;
    std::vector<int> dfn, low;
    std::vector<bool> in_stack;
    std::stack<int> st;
    int timer;
    std::vector<std::vector<int>> sccs;

    void dfs(int u) {
        dfn[u] = low[u] = ++timer;
        st.push(u);
        in_stack[u] = true;

        for (int v : adj[u]) {
            if (!dfn[v]) {
                dfs(v);
                low[u] = std::min(low[u], low[v]);
            } else if (in_stack[v]) {
                low[u] = std::min(low[u], dfn[v]);
            }
        }

        if (low[u] == dfn[u]) {
            std::vector<int> scc;
            while (true) {
                int v = st.top();
                st.pop();
                in_stack[v] = false;
                scc.push_back(v);
                if (u == v) break;
            }
            sccs.push_back(scc);
        }
    }

public:
    TarjanSCC(int n) : n(n), adj(n), dfn(n, 0), low(n, 0), in_stack(n, false), timer(0) {}

    void add_edge(int u, int v) {
        adj[u].push_back(v);
    }

    std::vector<std::vector<int>> run() {
        for (int i = 0; i < n; i++) {
            if (!dfn[i]) dfs(i);
        }
        return sccs;
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('lca', 'Lowest Common Ancestor (LCA) using Binary Lifting', 'class LCA {
    int n;
    int LOGN;
    std::vector<std::vector<int>> adj;
    std::vector<std::vector<int>> up;
    std::vector<int> tin, tout, depth;
    int timer;

    void dfs(int u, int p, int d) {
        depth[u] = d;
        tin[u] = ++timer;
        up[u][0] = p;
        for (int i = 1; i < LOGN; i++) {
            up[u][i] = up[up[u][i - 1]][i - 1];
        }

        for (int v : adj[u]) {
            if (v != p) {
                dfs(v, u, d + 1);
            }
        }
        tout[u] = ++timer;
    }

public:
    LCA(int n, int root = ${1:1}) : n(n), timer(0) {
        LOGN = std::ceil(std::log2(n)) + 1;
        adj.resize(n + 1);
        up.assign(n + 1, std::vector<int>(LOGN));
        tin.resize(n + 1);
        tout.resize(n + 1);
        depth.resize(n + 1);
    }

    void add_edge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u);
    }

    void init(int root = ${1:1}) {
        dfs(root, root, 0);
    }

    bool is_ancestor(int u, int v) {
        return tin[u] <= tin[v] && tout[u] >= tout[v];
    }

    int lca(int u, int v) {
        if (is_ancestor(u, v)) return u;
        if (is_ancestor(v, u)) return v;
        for (int i = LOGN - 1; i >= 0; i--) {
            if (!is_ancestor(up[u][i], v)) {
                u = up[u][i];
            }
        }
        return up[u][0];
    }

    int get_dist(int u, int v) {
        return depth[u] + depth[v] - 2 * depth[lca(u, v)];
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('sieve', 'Sieve of Eratosthenes for prime number generation', 'std::vector<int> sieve(int limit) {
    std::vector<bool> is_prime(limit + 1, true);
    is_prime[0] = is_prime[1] = false;
    for (int p = 2; p * p <= limit; p++) {
        if (is_prime[p]) {
            for (int i = p * p; i <= limit; i += p) {
                is_prime[i] = false;
            }
        }
    }
    std::vector<int> primes;
    for (int p = 2; p <= limit; p++) {
        if (is_prime[p]) {
            primes.push_back(p);
        }
    }
    return primes;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('modpow', 'Fast modular exponentiation (binary exponentiation)', 'long long modpow(long long base, long long exp, long long mod) {
    long long res = 1;
    base %= mod;
    while (exp > 0) {
        if (exp % 2 == 1) res = (res * base) % mod;
        base = (base * base) % mod;
        exp /= 2;
    }
    return res;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('matrixpow', 'Matrix multiplication and exponentiation', 'using ValType = long long;
using Matrix = std::vector<std::vector<ValType>>;

Matrix multiply(const Matrix& A, const Matrix& B, ValType mod) {
    int n = A.size();
    int m = A[0].size();
    int p = B[0].size();
    Matrix C(n, std::vector<ValType>(p, 0));
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < p; j++) {
            for (int k = 0; k < m; k++) {
                C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % mod;
            }
        }
    }
    return C;
}

Matrix matrix_pow(Matrix A, long long exp, ValType mod) {
    int n = A.size();
    Matrix res(n, std::vector<ValType>(n, 0));
    for (int i = 0; i < n; i++) res[i][i] = 1;
    while (exp > 0) {
        if (exp % 2 == 1) res = multiply(res, A, mod);
        A = multiply(A, A, mod);
        exp /= 2;
    }
    return res;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('extgcd', 'Extended Euclidean Algorithm for GCD and linear Diophantine equations', 'long long extgcd(long long a, long long b, long long& x, long long& y) {
    if (b == 0) {
        x = 1;
        y = 0;
        return a;
    }
    long long x1, y1;
    long long g = extgcd(b, a % b, x1, y1);
    x = y1;
    y = x1 - y1 * (a / b);
    return g;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('kmp', 'Knuth-Morris-Pratt (KMP) pattern matching algorithm', 'std::vector<int> compute_pi(const std::string& pattern) {
    int m = pattern.length();
    std::vector<int> pi(m, 0);
    for (int i = 1; i < m; i++) {
        int j = pi[i - 1];
        while (j > 0 && pattern[i] != pattern[j]) {
            j = pi[j - 1];
        }
        if (pattern[i] == pattern[j]) {
            j++;
        }
        pi[i] = j;
    }
    return pi;
}

std::vector<int> kmp_search(const std::string& text, const std::string& pattern) {
    std::vector<int> matches;
    std::vector<int> pi = compute_pi(pattern);
    int n = text.length();
    int m = pattern.length();
    int j = 0;
    for (int i = 0; i < n; i++) {
        while (j > 0 && text[i] != pattern[j]) {
            j = pi[j - 1];
        }
        if (text[i] == pattern[j]) {
            j++;
        }
        if (j == m) {
            matches.push_back(i - m + 1);
            j = pi[j - 1];
        }
    }
    return matches;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('zfunc', 'Z-algorithm for linear-time prefix matching', 'std::vector<int> z_function(const std::string& s) {
    int n = s.length();
    std::vector<int> z(n, 0);
    int l = 0, r = 0;
    for (int i = 1; i < n; i++) {
        if (i <= r) {
            z[i] = std::min(r - i + 1, z[i - l]);
        }
        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) {
            z[i]++;
        }
        if (i + z[i] - 1 > r) {
            l = i;
            r = i + z[i] - 1;
        }
    }
    return z;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('stringhash', 'Double rolling hash for substrings', 'struct DoubleHash {
    const long long P1 = ${1:313};
    const long long M1 = ${2:1e9 + 7};
    const long long P2 = ${3:317};
    const long long M2 = ${4:1e9 + 9};

    std::vector<long long> h1, h2;
    std::vector<long long> p1, p2;

    DoubleHash(const std::string& s) {
        int n = s.length();
        h1.assign(n + 1, 0);
        h2.assign(n + 1, 0);
        p1.assign(n + 1, 1);
        p2.assign(n + 1, 1);

        for (int i = 0; i < n; i++) {
            h1[i + 1] = (h1[i] * P1 + s[i]) % M1;
            h2[i + 1] = (h2[i] * P2 + s[i]) % M2;
            p1[i + 1] = (p1[i] * P1) % M1;
            p2[i + 1] = (p2[i] * P2) % M2;
        }
    }

    std::pair<long long, long long> get_hash(int l, int r) {
        long long hash1 = (h1[r + 1] - (h1[l] * p1[r - l + 1]) % M1 + M1) % M1;
        long long hash2 = (h2[r + 1] - (h2[l] * p2[r - l + 1]) % M2 + M2) % M2;
        return {hash1, hash2};
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('suffixarray', 'Suffix Array constructor in O(N log N)', 'std::vector<int> suffix_array(std::string s) {
    s += "${1:$}";
    int n = s.size();
    std::vector<int> p(n), c(n);
    {
        std::vector<std::pair<char, int>> a(n);
        for (int i = 0; i < n; i++) a[i] = {s[i], i};
        std::sort(a.begin(), a.end());
        for (int i = 0; i < n; i++) p[i] = a[i].second;
        c[p[0]] = 0;
        for (int i = 1; i < n; i++) {
            if (a[i].first == a[i - 1].first) {
                c[p[i]] = c[p[i - 1]];
            } else {
                c[p[i]] = c[p[i - 1]] + 1;
            }
        }
    }
    int k = 0;
    while ((1 << k) < n) {
        std::vector<std::pair<std::pair<int, int>, int>> a(n);
        for (int i = 0; i < n; i++) {
            a[i] = {{c[i], c[(i + (1 << k)) % n]}, i};
        }
        std::sort(a.begin(), a.end());
        for (int i = 0; i < n; i++) p[i] = a[i].second;
        c[p[0]] = 0;
        for (int i = 1; i < n; i++) {
            if (a[i].first == a[i - 1].first) {
                c[p[i]] = c[p[i - 1]];
            } else {
                c[p[i]] = c[p[i - 1]] + 1;
            }
        }
        k++;
    }
    p.erase(p.begin());
    return p;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('convexhull', 'Convex Hull using Monotone Chain algorithm', 'struct Point {
    long long x, y;
    bool operator<(const Point& other) const {
        return x < other.x || (x == other.x && y < other.y);
    }
};

long long cross_product(const Point& O, const Point& A, const Point& B) {
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

std::vector<Point> convex_hull(std::vector<Point>& pts) {
    int n = pts.size(), k = 0;
    if (n <= 3) return pts;
    std::vector<Point> hull(2 * n);
    std::sort(pts.begin(), pts.end());

    for (int i = 0; i < n; ++i) {
        while (k >= 2 && cross_product(hull[k - 2], hull[k - 1], pts[i]) <= 0) {
            k--;
        }
        hull[k++] = pts[i];
    }

    for (int i = n - 2, t = k + 1; i >= 0; i--) {
        while (k >= t && cross_product(hull[k - 2], hull[k - 1], pts[i]) <= 0) {
            k--;
        }
        hull[k++] = pts[i];
    }

    hull.resize(k - 1);
    return hull;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('lineintersection', 'Line segment intersection check', 'struct Point {
    double x, y;
};

bool on_segment(Point p, Point q, Point r) {
    return q.x <= std::max(p.x, r.x) && q.x >= std::min(p.x, r.x) &&
           q.y <= std::max(p.y, r.y) && q.y >= std::min(p.y, r.y);
}

int orientation(Point p, Point q, Point r) {
    double val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (std::abs(val) < ${1:1e-9}) return 0;
    return (val > 0) ? 1 : 2;
}

bool do_intersect(Point p1, Point q1, Point p2, Point q2) {
    int o1 = orientation(p1, q1, p2);
    int o2 = orientation(p1, q1, q2);
    int o3 = orientation(p2, q2, p1);
    int o4 = orientation(p2, q2, q1);

    if (o1 != o2 && o3 != o4) return true;

    if (o1 == 0 && on_segment(p1, p2, q1)) return true;
    if (o2 == 0 && on_segment(p1, q2, q1)) return true;
    if (o3 == 0 && on_segment(p2, p1, q2)) return true;
    if (o4 == 0 && on_segment(p2, q1, q2)) return true;

    return false;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('binarysearch', 'Binary Search templates for finding first or last matching condition', 'template <typename ${1:T} = int, typename Func>
${1:T} first_true(${1:T} low, ${1:T} high, Func f) {
    ${1:T} ans = high + 1;
    while (low <= high) {
        ${1:T} mid = low + (high - low) / 2;
        if (f(mid)) {
            ans = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return ans;
}

template <typename ${1:T} = int, typename Func>
${1:T} last_true(${1:T} low, ${1:T} high, Func f) {
    ${1:T} ans = low - 1;
    while (low <= high) {
        ${1:T} mid = low + (high - low) / 2;
        if (f(mid)) {
            ans = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return ans;
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('fastio', 'Fast I/O speedup for C++', 'void fast_io() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);
    std::cout.tie(NULL);
}', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('pbdstree', 'Policy-based data structure (ordered set)', '#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>

template <typename ${1:T}>
using ordered_set = __gnu_pbds::tree<
    ${1:T},
    __gnu_pbds::null_type,
    std::${2:less}<${1:T}>,
    __gnu_pbds::rb_tree_tag,
    __gnu_pbds::tree_order_statistics_node_update
>;', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('timecalc', 'Code execution time calculator helper', '#include <chrono>
#include <iostream>

class Timer {
    std::chrono::high_resolution_clock::time_point start_time;

public:
    Timer() {
        start_time = std::chrono::high_resolution_clock::now();
    }

    void stop() {
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::${1:milliseconds}>(end_time - start_time).count();
        std::cerr << "Time taken: " << duration << " ${2:ms}" << std::endl;
    }
};', 'cpp', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('dsu_py', 'Disjoint Set Union (DSU) in Python', 'class DSU:
    def __init__(self, ${1:n}):
        self.parent = list(range(${1:n}))
        self.size = [1] * ${1:n}

    def find(self, i):
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def unite(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            if self.size[root_i] < self.size[root_j]:
                root_i, root_j = root_j, root_i
            self.parent[root_j] = root_i
            self.size[root_i] += self.size[root_j]
            return True
        return False

    def get_size(self, i):
        return self.size[self.find(i)]', 'python', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('fastio_py', 'Fast standard input/output setup in Python', 'import sys

# Fast Standard Input/Output
input = sys.stdin.readline
${1:print} = lambda *args, **kwargs: sys.stdout.write(" ".join(map(str, args)) + kwargs.get("end", "\n"))', 'python', 0);

INSERT OR IGNORE INTO Snippets (trigger, description, code, language, is_default) VALUES
('segtree_py', 'Segment Tree in Python', 'class SegmentTree:
    def __init__(self, arr, neutral=${1:0}):
        self.n = len(arr)
        self.neutral = neutral
        self.tree = [neutral] * (4 * self.n)
        self.build(arr, 1, 0, self.n - 1)

    def merge(self, a, b):
        return ${2:a + b}

    def build(self, arr, node, start, end):
        if start == end:
            self.tree[node] = arr[start]
            return
        mid = (start + end) // 2
        self.build(arr, 2 * node, start, mid)
        self.build(arr, 2 * node + 1, mid + 1, end)
        self.tree[node] = self.merge(self.tree[2 * node], self.tree[2 * node + 1])

    def update(self, node, start, end, idx, val):
        if start == end:
            self.tree[node] = val
            return
        mid = (start + end) // 2
        if idx <= mid:
            self.update(2 * node, start, mid, idx, val)
        else:
            self.update(2 * node + 1, mid + 1, end, idx, val)
        self.tree[node] = self.merge(self.tree[2 * node], self.tree[2 * node + 1])

    def query(self, node, start, end, l, r):
        if r < start or end < l:
            return self.neutral
        if l <= start and end <= r:
            return self.tree[node]
        mid = (start + end) // 2
        return self.merge(
            self.query(2 * node, start, mid, l, r),
            self.query(2 * node + 1, mid + 1, end, l, r)
        )', 'python', 0);
