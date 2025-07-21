#!/usr/bin/env python3
import os
from typing import List

from sshtunnel import SSHTunnelForwarder
import psycopg2
from psycopg2.extras import execute_values

# === CONFIGURATION ===
SSH_HOST = "18.130.207.89"
SSH_PORT = 22
SSH_USER = "ec2-user"
SSH_PKEY = r"C:\Users\Owner\.ssh\aws\testEC2KeyPair.pem"      # Path to your EC2 SSH private key
REMOTE_BIND_ADDRESS = ("127.0.0.1", 5432)  # Where Postgres listens on the EC2 host
LOCAL_BIND_ADDRESS = ("localhost", 6543)   # Local port to forward to

DB_NAME = "your_database"
DB_USER = "postgres"
DB_PASSWORD = "temp123pass"

INPUT_FILE = r"C:\Users\Owner\Desktop\Jupyter-Notebooks\Data\glove.840B.300d.txt"   # Plain text file, one record per line
CHUNK_SIZE = 10000                       # Number of lines per batch

# SQL: adjust columns to match your table schema
INSERT_SQL = """
    INSERT INTO words (word, embedding)
    VALUES %s
    ON CONFLICT (word) DO NOTHING
"""


def parse_line(line:List) -> tuple[str, str]:
    """
    Parse one line of your text file into a tuple matching table columns.
    """

    return line[0], "[" + ", ".join(line[1:]) + "]"

def main(dimensions=300, skip_rows=1):
    # 1. Set up SSH tunnel
    with SSHTunnelForwarder(
        (SSH_HOST, SSH_PORT),
        ssh_username=SSH_USER,
        ssh_pkey=SSH_PKEY,
        remote_bind_address=REMOTE_BIND_ADDRESS,
        local_bind_address=LOCAL_BIND_ADDRESS
    ) as tunnel:
        print(f"Tunnel open: 127.0.0.1:{tunnel.local_bind_port} -> {REMOTE_BIND_ADDRESS}")

        # 2. Connect to Postgres over the tunnel
        conn = psycopg2.connect(
            host=LOCAL_BIND_ADDRESS[0],
            port=tunnel.local_bind_port,
            # dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = False
        cur = conn.cursor()

        # 3. Read-and-insert in chunks
        batch = []
        count_misformatted = 0
        with open(INPUT_FILE, "r", encoding='utf-8', errors='replace') as f:
            for idx, line in enumerate(f, start=skip_rows):

                split_line = line.split()

                # check for the "word" actually being some number of space separated dots
                if split_line[0] == "." or split_line[0][0] == "." or len(split_line) != dimensions + 1:
                    count_misformatted += 1
                    continue

                try:
                    batch.append(parse_line(split_line))

                except Exception as e:
                    print(f"Error processing line {idx}")
                    print(f" the line is: \n{line}")
                    print(f"exception: {e}")
                    break

                if idx % CHUNK_SIZE == 0:
                    # Bulk-insert this chunk
                    execute_values(cur, INSERT_SQL, batch)
                    conn.commit()
                    print(f"Inserted {idx} rows so far...")
                    batch.clear()

            # Insert any remaining rows
            if batch:
                execute_values(cur, INSERT_SQL, batch)
                conn.commit()
                print(f"Inserted final {len(batch)} rows (total {idx}).")

        # 4. Clean up
        cur.close()
        conn.close()
        print("All done!")

if __name__ == "__main__":
    main()

