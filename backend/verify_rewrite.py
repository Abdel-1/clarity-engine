import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.db.models.client import Client
from app.db.models.user import User
from app.db.models.brand_system import BrandSystem
from app.db.models.analyses import Analysis
from app.api.routes.analysis import run_rewrite, RewriteRequest

def main():
    db = SessionLocal()
    try:
        # 1. Fetch active brand system
        bs = db.query(BrandSystem).filter(BrandSystem.brand_name == "Technopark").first()
        if not bs:
            print("❌ Technopark BrandSystem not found in DB!")
            return

        print(f"Found Brand System: {bs.brand_name} (ID: {bs.id})")

        # 2. Insert a mock analysis with high score (e.g. 92) and high quality message
        high_score_msg = (
            "Une idée peut naître n'importe où, mais c'est ensemble que nous la transformons en impact durable. "
            "Depuis 25 ans, Technopark Morocco ne se contente pas d'héberger des entreprises. Nous connectons "
            "les talents, les territoires et la technologie pour offrir à chaque entrepreneur les mêmes opportunités "
            "de réussite, partout au Royaume. Rejoignez notre communauté active et faisons grandir l'innovation marocaine."
        )

        # Check if high score analysis already exists
        mock_analysis = db.query(Analysis).filter(
            Analysis.brand_system_id == bs.id,
            Analysis.message_body == high_score_msg
        ).first()

        if not mock_analysis:
            mock_analysis = Analysis(
                brand_system_id=bs.id,
                message_title="High Score Verification",
                message_body=high_score_msg,
                clarity_score=92,
                sub_clarity=18,
                sub_alignment=19,
                sub_focus=18,
                sub_tone=18,
                sub_narrative_contribution=19,
                narrative_risk="Low",
                points_forts=json.dumps(["Excellent style", "Perfect brand alignment"]),
                points_faibles=json.dumps([]),
                recommandations=json.dumps([]),
                channel="LinkedIn",
                content_type="Post Réseaux Sociaux",
            )
            db.add(mock_analysis)
            db.commit()
            db.refresh(mock_analysis)
            print(f"Created mock high-score parent analysis in DB (ID: {mock_analysis.id})")
        else:
            print(f"Found existing mock high-score parent analysis (ID: {mock_analysis.id})")

        # 3. Simulate calling run_rewrite on this high score message
        payload = RewriteRequest(
            brand_system_id=bs.id,
            original_message=high_score_msg,
            instruction="Améliore ce message en appliquant les recommandations",
            points_faibles=[],
            recommandations=[]
        )

        print("\n--- Running Rewrite with Quality Guard Fallback ---")
        result = run_rewrite(payload=payload, db=db)
        print("--- Execution Complete ---")
        print("\nResult fields returned:")
        for k, v in result.items():
            if k == "rewritten_message":
                print(f" - {k}: {v[:100]}... (len: {len(v)})")
            else:
                print(f" - {k}: {v}")

        # Check if the fallback is returned
        if result["rewritten_message"] == high_score_msg:
            print("\n✅ SUCCESS: Quality Guard fallback activated perfectly!")
            print(f"✅ CHANGES MADE: {result['changes_made']}")
            print(f"✅ FINAL SCORE RETURNED: {result['clarity_score']}/100")
        else:
            print("\n❌ FAILED: Fallback was not activated. The rewrite changed the message.")

    finally:
        db.close()

if __name__ == "__main__":
    main()
