SELECT
    w.word
FROM
    words AS w
WHERE
    w.word NOT LIKE ALL (ARRAY['%king%', '%King%'])
ORDER BY
    w.embedding <=> (
    SELECT embedding           -- grab the reference vector …
    FROM   words
    WHERE  word = 'king'       -- … for the word “king”
    LIMIT  1                   -- (defensive: only one row)
    )
    LIMIT 5;                            -- return the 5 nearest neighbours
