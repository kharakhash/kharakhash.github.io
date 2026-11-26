#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

DIR_LABELS = {
    "L": "ArrowLeft",
    "R": "ArrowRight",
    "U": "ArrowUp",
    "D": "ArrowDown",
}


def parse_minisat_output(path):
    text = path.read_text(encoding="ascii", errors="ignore").strip().split()
    if not text:
        raise ValueError("Empty minisat output")
    if text[0] != "SAT":
        return None
    lits = []
    for token in text[1:]:
        try:
            lit = int(token)
        except ValueError:
            continue
        if lit == 0:
            break
        lits.append(lit)
    return {lit for lit in lits if lit > 0}


def main():
    parser = argparse.ArgumentParser(description="Decode minisat model using map file.")
    parser.add_argument("--map", type=Path, default=Path("sat/quest4x4.map.json"))
    parser.add_argument("--out", type=Path, default=Path("sat/quest4x4.out"))
    args = parser.parse_args()

    model = parse_minisat_output(args.out)
    if model is None:
        print("UNSAT or UNKNOWN")
        return

    payload = json.loads(args.map.read_text(encoding="ascii"))
    size = payload["size"]
    horizon = payload["horizon"]
    values = payload["values"]

    init_cells = payload["init_cell_vars"]
    grid = [[None for _ in range(size)] for _ in range(size)]
    for key, mapping in init_cells.items():
        r_str, c_str = key.split(",")
        r = int(r_str)
        c = int(c_str)
        chosen = None
        for v_str, var_id in mapping.items():
            if int(var_id) in model:
                chosen = int(v_str)
                break
        grid[r][c] = chosen

    dir_vars = payload["dir_vars"]
    moves = []
    for t in range(horizon):
        step_vars = dir_vars.get(str(t), dir_vars.get(t))
        chosen = None
        if step_vars:
            for d, var_id in step_vars.items():
                if int(var_id) in model:
                    chosen = d
                    break
        moves.append(chosen or "?")

    print("Initial grid:")
    for row in grid:
        print(" ".join("." if v == 0 else str(v) for v in row))
    print("Moves:")
    print(" ".join(DIR_LABELS.get(m, m) for m in moves))


if __name__ == "__main__":
    main()
