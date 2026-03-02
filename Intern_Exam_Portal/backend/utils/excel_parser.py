import pandas as pd
from typing import List, Dict


def parse_mcq_excel(file_bytes: bytes) -> List[Dict]:
    """
    Parse an Excel file with MCQs.
    Expected columns: question, option_a, option_b, option_c, option_d, correct_answer
    correct_answer should be 'a', 'b', 'c', or 'd'
    Returns list of dicts ready to insert into DB.
    """
    import io
    df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    required = {"question", "option_a", "option_b", "option_c", "option_d", "correct_answer"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    mcqs = []
    for i, row in df.iterrows():
        ans = str(row["correct_answer"]).strip().lower()
        if ans not in ("a", "b", "c", "d"):
            raise ValueError(f"Row {i+2}: correct_answer must be a, b, c, or d. Got: {ans}")
        mcqs.append({
            "question": str(row["question"]).strip(),
            "option_a": str(row["option_a"]).strip(),
            "option_b": str(row["option_b"]).strip(),
            "option_c": str(row["option_c"]).strip(),
            "option_d": str(row["option_d"]).strip(),
            "correct_answer": ans,
        })

    return mcqs
