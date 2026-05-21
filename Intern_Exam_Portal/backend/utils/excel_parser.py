import pandas as pd
from typing import List, Dict


def parse_mcq_excel(file_bytes: bytes) -> List[Dict]:
    """
    Parse an Excel file with MCQ and/or Descriptive questions.

    Required columns for ALL rows:
        question, option_a, option_b, option_c, option_d, correct_answer, question_mark

    question_mark values: 2M / 5M / 10M  (for descriptive) OR leave blank for MCQ.
    For MCQ rows  : option_a-d and correct_answer must be filled; question_mark can be blank.
    For Descriptive rows: option_a-d and correct_answer can be blank; question_mark MUST be 2M/5M/10M.

    A row is treated as descriptive when question_mark has a value AND correct_answer is blank.
    """
    import io
    df = pd.read_excel(io.BytesIO(file_bytes))

    # Normalize column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # question_mark column is new — make it optional so old sheets still work
    required_base = {"question", "option_a", "option_b", "option_c", "option_d", "correct_answer"}
    missing = required_base - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    has_mark_col = "question_mark" in df.columns
    has_subject_col = "subject" in df.columns

    questions = []
    for i, row in df.iterrows():
        question_text = str(row["question"]).strip()
        if not question_text or question_text.lower() == "nan":
            continue  # skip blank rows

        raw_answer = str(row.get("correct_answer", "")).strip().lower()
        correct_answer_empty = raw_answer in ("", "nan", "none")

        # Parse question_mark
        question_mark = None
        if has_mark_col:
            raw_mark = str(row.get("question_mark", "")).strip().upper().replace(" ", "")
            if raw_mark in ("2M", "5M", "10M"):
                question_mark = int(raw_mark.replace("M", ""))

        # Parse subject (optional; case-insensitive, stored Title Case; blank → "General")
        subject = "General"
        if has_subject_col:
            raw_subject = str(row.get("subject", "")).strip()
            if raw_subject and raw_subject.lower() != "nan":
                subject = raw_subject.title()

        # Determine question type
        if question_mark is not None and correct_answer_empty:
            # Descriptive question
            questions.append({
                "question_type": "descriptive",
                "subject": subject,
                "question": question_text,
                "option_a": None,
                "option_b": None,
                "option_c": None,
                "option_d": None,
                "correct_answer": None,
                "question_mark": question_mark,
            })
        else:
            # MCQ question — validate options and correct_answer
            if correct_answer_empty or raw_answer not in ("a", "b", "c", "d"):
                raise ValueError(
                    f"Row {i + 2}: correct_answer must be a, b, c, or d for MCQ questions. "
                    f"Got: '{raw_answer}'. "
                    f"For descriptive questions, leave correct_answer blank and set question_mark (2M/5M/10M)."
                )
            opt_a = str(row.get("option_a", "")).strip()
            opt_b = str(row.get("option_b", "")).strip()
            opt_c = str(row.get("option_c", "")).strip()
            opt_d = str(row.get("option_d", "")).strip()
            if not all([opt_a, opt_b, opt_c, opt_d]):
                raise ValueError(f"Row {i + 2}: All four options (A-D) are required for MCQ questions.")
            questions.append({
                "question_type": "mcq",
                "subject": subject,
                "question": question_text,
                "option_a": opt_a,
                "option_b": opt_b,
                "option_c": opt_c,
                "option_d": opt_d,
                "correct_answer": raw_answer,
                "question_mark": None,
            })

    if not questions:
        raise ValueError("No valid questions found in the uploaded file.")

    return questions
