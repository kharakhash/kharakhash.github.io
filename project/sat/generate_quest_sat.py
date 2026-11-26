#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

VALUES = [0, 1, 2, 4, 8, 16, 32, 64, 128]
EMPTY = 0
TILE_VALUES = [2, 4, 8, 16, 32, 64, 128]
SPLIT_VALUES = {
    2: 1,
    4: None,  # 4 splits into 2s, which disappear immediately
    8: 4,
    16: 8,
    32: 16,
    64: 32,
    128: 64,
}
DIRECTIONS = ["L", "R", "U", "D"]

INITIAL_TILES_BY_SIZE = {
    3: [32, 16, 8],
    4: [128, 64, 32, 16, 8],
}


class CNFBuilder:
    def __init__(self):
        self.var_count = 0
        self.clauses = []
        self._cell_vars = {}
        self._dir_vars = {}
        self.init_cell_map = {}
        self.dir_map = {}

    def new_var(self):
        self.var_count += 1
        return self.var_count

    def add_clause(self, lits):
        if not lits:
            raise ValueError("empty clause")
        self.clauses.append(lits)

    def add_exactly_one(self, vars_list):
        self.add_clause(list(vars_list))
        for i in range(len(vars_list)):
            for j in range(i + 1, len(vars_list)):
                self.add_clause([-vars_list[i], -vars_list[j]])

    def add_and_equiv(self, out_var, lits):
        # out_var <-> AND(lits)
        for lit in lits:
            self.add_clause([-out_var, lit])
        neg_lits = [-lit for lit in lits]
        self.add_clause(neg_lits + [out_var])

    def cell_var(self, t, r, c, value):
        key = (t, r, c, value)
        var_id = self._cell_vars.get(key)
        if var_id is None:
            var_id = self.new_var()
            self._cell_vars[key] = var_id
            if t == 0:
                self.init_cell_map.setdefault((r, c), {})[value] = var_id
        return var_id

    def dir_var(self, t, direction):
        key = (t, direction)
        var_id = self._dir_vars.get(key)
        if var_id is None:
            var_id = self.new_var()
            self._dir_vars[key] = var_id
            self.dir_map.setdefault(t, {})[direction] = var_id
        return var_id


def iter_lines(size, direction):
    if direction in ("L", "R"):
        for r in range(size):
            if direction == "L":
                yield [(r, c) for c in range(size)]
            else:
                yield [(r, c) for c in reversed(range(size))]
    else:
        for c in range(size):
            if direction == "U":
                yield [(r, c) for r in range(size)]
            else:
                yield [(r, c) for r in reversed(range(size))]


def add_step_constraints(cnf, size, t, horizon):
    if t >= horizon:
        return

    support = {}
    for r in range(size):
        for c in range(size):
            for v in VALUES:
                if v == EMPTY:
                    continue
                support[(r, c, v)] = []

    for direction in DIRECTIONS:
        dir_var = cnf.dir_var(t, direction)
        for line in iter_lines(size, direction):
            empties = [cnf.cell_var(t, r, c, EMPTY) for (r, c) in line]

            # Self contributions (stay or split in place)
            for i, (r, c) in enumerate(line):
                for v in TILE_VALUES:
                    in_var = cnf.cell_var(t, r, c, v)
                    # Stay (no split)
                    if i == 0:
                        stay_lits = [dir_var, in_var]
                    else:
                        stay_lits = [dir_var, in_var, -empties[i - 1]]
                    stay_contrib = cnf.new_var()
                    cnf.add_and_equiv(stay_contrib, stay_lits)
                    support[(r, c, v)].append(stay_contrib)

                    # Split in place
                    split_val = SPLIT_VALUES[v]
                    if split_val is not None and i > 0:
                        split_lits = [dir_var, in_var, empties[i - 1]]
                        split_contrib = cnf.new_var()
                        cnf.add_and_equiv(split_contrib, split_lits)
                        support[(r, c, split_val)].append(split_contrib)

            # Incoming split targets for leftmost empty cells in a block
            for i, (r, c) in enumerate(line):
                for j in range(i + 1, size):
                    for v in TILE_VALUES:
                        split_val = SPLIT_VALUES[v]
                        if split_val is None:
                            continue
                        in_var = cnf.cell_var(t, line[j][0], line[j][1], v)
                        incoming_lits = [dir_var, in_var]
                        # Empty block from i to j-1
                        for k in range(i, j):
                            incoming_lits.append(empties[k])
                        # i must be the leftmost empty in its block
                        if i > 0:
                            incoming_lits.append(-empties[i - 1])
                        incoming_contrib = cnf.new_var()
                        cnf.add_and_equiv(incoming_contrib, incoming_lits)
                        support[(r, c, split_val)].append(incoming_contrib)

    # Output support constraints for time t+1
    for r in range(size):
        for c in range(size):
            for v in VALUES:
                if v == EMPTY:
                    continue
                out_var = cnf.cell_var(t + 1, r, c, v)
                contribs = support[(r, c, v)]
                if not contribs:
                    cnf.add_clause([-out_var])
                    continue
                cnf.add_clause([-out_var] + contribs)
                for contrib in contribs:
                    cnf.add_clause([-contrib, out_var])


def build_cnf(size, horizon):
    if size not in INITIAL_TILES_BY_SIZE:
        raise ValueError("Only size 3 or 4 is supported by this generator")

    initial_tiles = INITIAL_TILES_BY_SIZE[size]

    cnf = CNFBuilder()

    # Cell domains: exactly one value per cell per time.
    for t in range(horizon + 1):
        for r in range(size):
            for c in range(size):
                vars_list = [cnf.cell_var(t, r, c, v) for v in VALUES]
                cnf.add_exactly_one(vars_list)

    # Direction choice per move.
    for t in range(horizon):
        vars_list = [cnf.dir_var(t, d) for d in DIRECTIONS]
        cnf.add_exactly_one(vars_list)

    # Initial tiles for size.
    allowed_values = set(initial_tiles) | {EMPTY}
    for r in range(size):
        for c in range(size):
            for v in VALUES:
                if v not in allowed_values:
                    cnf.add_clause([-cnf.cell_var(0, r, c, v)])

    # Each initial tile appears exactly once.
    for v in initial_tiles:
        vars_list = [cnf.cell_var(0, r, c, v) for r in range(size) for c in range(size)]
        cnf.add_clause(vars_list)
        for i in range(len(vars_list)):
            for j in range(i + 1, len(vars_list)):
                cnf.add_clause([-vars_list[i], -vars_list[j]])

    # Quest goal: grid empty at final step.
    for r in range(size):
        for c in range(size):
            cnf.add_clause([cnf.cell_var(horizon, r, c, EMPTY)])

    # Transitions
    for t in range(horizon):
        add_step_constraints(cnf, size, t, horizon)

    return cnf


def write_outputs(cnf, size, horizon, cnf_path, map_path):
    cnf_path.parent.mkdir(parents=True, exist_ok=True)
    with cnf_path.open("w", encoding="ascii") as f:
        f.write(f"p cnf {cnf.var_count} {len(cnf.clauses)}\n")
        for clause in cnf.clauses:
            line = " ".join(str(lit) for lit in clause) + " 0\n"
            f.write(line)

    map_payload = {
        "size": size,
        "horizon": horizon,
        "values": VALUES,
        "directions": DIRECTIONS,
        "dir_vars": cnf.dir_map,
        "init_cell_vars": {
            f"{r},{c}": {str(v): vid for v, vid in sorted(values.items())}
            for (r, c), values in sorted(cnf.init_cell_map.items())
        },
    }

    map_path.parent.mkdir(parents=True, exist_ok=True)
    with map_path.open("w", encoding="ascii") as f:
        json.dump(map_payload, f, indent=2, sort_keys=True)


def parse_fixed_grid(path, size):
    text = path.read_text(encoding="ascii").strip()
    rows = [line.strip() for line in text.splitlines() if line.strip()]
    if len(rows) != size:
        raise ValueError(f"Fixed grid must have {size} rows")
    grid = []
    for line in rows:
        parts = [p for p in line.replace(",", " ").split(" ") if p]
        if len(parts) != size:
            raise ValueError(f"Each row must have {size} values")
        row = []
        for part in parts:
            if part == ".":
                row.append(EMPTY)
            else:
                row.append(int(part))
        grid.append(row)
    return grid


def apply_fixed_grid(cnf, size, grid):
    for r in range(size):
        for c in range(size):
            value = grid[r][c]
            for v in VALUES:
                lit = cnf.cell_var(0, r, c, v)
                if v == value:
                    cnf.add_clause([lit])
                else:
                    cnf.add_clause([-lit])


def main():
    parser = argparse.ArgumentParser(description="Generate SAT CNF for quest mode (4x4, split rules).")
    parser.add_argument("--size", type=int, default=4)
    parser.add_argument("--horizon", type=int, default=40)
    parser.add_argument("--cnf", type=Path, default=Path("sat/quest4x4.cnf"))
    parser.add_argument("--map", type=Path, default=Path("sat/quest4x4.map.json"))
    parser.add_argument("--fixed-grid", type=Path, default=None)
    args = parser.parse_args()

    cnf = build_cnf(args.size, args.horizon)
    if args.fixed_grid:
        fixed = parse_fixed_grid(args.fixed_grid, args.size)
        apply_fixed_grid(cnf, args.size, fixed)
    write_outputs(cnf, args.size, args.horizon, args.cnf, args.map)
    print(f"CNF written to {args.cnf}")
    print(f"Map written to {args.map}")
    print(f"Variables: {cnf.var_count}, Clauses: {len(cnf.clauses)}")


if __name__ == "__main__":
    main()
