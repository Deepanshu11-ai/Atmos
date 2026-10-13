
from fastapi import FastAPI, HTTPException
from sqlalchemy import inspect

from backend.db.conn import engine

app = FastAPI()


@app.get("/")
def home():
    return {"message": "FastAPI is working"}


@app.get("/db/schemas")
def get_schemas():
    try:
        inspector = inspect(engine)
        schemas = inspector.get_schema_names()

        # Exclude PostgreSQL's built-in system schemas
        schemas = [
            schema for schema in schemas
            if schema not in ("information_schema",)
            and not schema.startswith("pg_")
        ]

        return {
            "status": "success",
            "count": len(schemas),
            "schemas": schemas
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch database schemas"
        )


@app.get("/db/schemas-with-tables")
def get_schemas_with_tables():
    try:
        inspector = inspect(engine)

        schemas = [
            schema for schema in inspector.get_schema_names()
            if schema != "information_schema"
            and not schema.startswith("pg_")
        ]

        result = {}

        for schema in schemas:
            result[schema] = inspector.get_table_names(
                schema=schema
            )

        return {
            "status": "success",
            "schemas": result
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch database schema details"
        )
