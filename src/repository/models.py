from sqlalchemy import Column, String, DateTime, Boolean, JSON, create_engine, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from typing import List, Optional, Union
import uuid

Base = declarative_base()

class PolicyRecord(Base):
    __tablename__ = 'policies'

    # Primary key for this specific database record
    id = Column(String, primary_key=True)
    
    # The stable identifier for the policy across versions
    policy_id = Column(String, index=True)
    version = Column(String, index=True)
    
    title = Column(String)
    domain = Column(String, index=True)
    scope = Column(String, index=True)
    
    # Indexing fields
    industry = Column(String, index=True)
    compliance_type = Column(String, index=True)
    functional_area = Column(String, index=True)
    
    # Flags
    is_template = Column(Boolean, default=False, index=True)
    template_id = Column(String, index=True, nullable=True)
    
    effective_date = Column(DateTime, default=datetime.utcnow)
    
    # Store the actual structured logic as JSON
    # This includes conditions, triggers, exceptions, and instructions
    content_json = Column(JSON)
    
    # Metadata for traceability
    raw_source = Column(String)
    rationale = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Composite index for policy_id and version
    __table_args__ = (
        Index('idx_policy_version', 'policy_id', 'version', unique=True),
    )

def get_engine(db_url="sqlite:///policy_repository.db"):
    return create_engine(db_url)

def init_db(engine):
    Base.metadata.create_all(engine)
