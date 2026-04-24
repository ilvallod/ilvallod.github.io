---
title: "SOAR"
date: 2026-04-24
draft: false
ShowToc: false
math: true
---

Using AlloyDB for PostgreSQL, I became interested in the underlying algorithm, based on ScaNN and recently extended with SOAR.

During indexing, a structure is built to organize vectors in space, so that search is performed only on a subset. Vectors are quantized and assigned to different partitions via SOAR. Let’s analyze this.

I have data in a vector database and a query $q$. I want to return the $k$ closest vectors to $q$. A linear scan gives exact results but is inefficient (intractable) due to the [curse of dimensionality](https://en.wikipedia.org/wiki/Curse_of_dimensionality).  
We approximate accuracy to gain efficiency, hence _Approximate Nearest Neighbor_.

### Spill Tree
Data replication to reduce partitioning errors.

![Spill tree diagram](/notes/spill-tree.png)

Here, $t$ is a separating hyperplane that divides the space into two regions. An overlap is introduced so that points near the boundary are replicated in both $A$ and $B$.

However, the complexity is exponential: if at each level of the tree a point $x$ falls into the overlap region, it is duplicated in both children and appears $2^h$ times.

## Vector Quantization
We approximate vector values with centroids. This process returns two objects: _codebook_ and _assignment function_.

$$C \in \mathbb{R}^{c\times d} \tag{1}$$

is a matrix with $c$ rows, each a vector in $\mathbb{R}^d$, so each row is a centroid.

$$\pi(v):\mathbb{R}^d \mapsto \{1,\dots, c\} \tag{2}$$

The assignment function ensures each vector is mapped to the nearest centroid. At query time, we compute the inner product between $q$ and all centroids, rank them by score, and retrieve points from those partitions.

This is not free: replacing $x$ with its centroid introduces error.

### Residual
What we lose by replacing $x$ with its centroid.

If the residual is large and positive, the centroid underestimates the true score, and the correct partition may not be visited.  
This happens when the residual $r$ is aligned with the query $q$, since the error is:

$$
\langle q, x \rangle - \langle q, C_{\pi(x)} \rangle = \langle q, r \rangle
$$

A high $\langle q, r \rangle$ makes the point harder to retrieve.[^soar-paper]

### Spilling with Orthogonality-Amplified Residuals
To avoid losing a point $x$ during search, we assign it to multiple partitions. But how do we choose the additional one?

![Orthogonal residuals diagram](/notes/ortogonal.png)

On the left, choosing $c'$ produces a new residual $r'$ similar to $r$.  
On the right, choosing $c''$ produces a residual $r''$ almost orthogonal to $r$.

This is crucial: if two residuals have similar direction, they fail in the same cases. If they are orthogonal, at least one will give a good score.

Thus, we choose the centroid using a loss that minimizes quantization error while penalizing alignment between residuals:

$$
L(r', r, Q) = \mathbb{E}_{q \in Q} \left[ w(\cos\theta)\, \langle q, r' \rangle^2 \right]
$$

where:
- $r = x - c$ is the residual of the first assignment  
- $r' = x - c'$ is the candidate residual  
- $q$ is a query $\in Q$[^1]  
- $\theta$ is the angle between $q$ and $r$  
- $w(\cos\theta)$ gives more weight to cases where the original error is high, i.e. when $r$ is aligned with $q$

This loss explicitly reduces correlation between errors $\langle q, r \rangle$ and $\langle q, r' \rangle$, which is the core idea of SOAR.[^soar-paper]

All these multiple assignments increase memory and indexing cost linearly with the number of copies per point. It is shown that a second assignment is already sufficient to cover most cases; additional ones bring marginal benefits relative to the cost.

Link to the official paper: https://arxiv.org/pdf/2404.00774

[^1]: $Q$ can be seen as a representative sample of real queries, i.e. the distribution of queries expected during system usage
