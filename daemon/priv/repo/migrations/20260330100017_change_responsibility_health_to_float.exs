defmodule Ema.Repo.Migrations.ChangeResponsibilityHealthToFloat do
  use Ecto.Migration

  def up do
    # Add a temporary float column
    alter table(:responsibilities) do
      add :health_float, :float, default: 1.0
    end

    flush()

    # Map existing string values to floats
    execute """
    UPDATE responsibilities SET health_float = CASE health
      WHEN 'healthy' THEN 1.0
      WHEN 'at_risk' THEN 0.5
      WHEN 'failing' THEN 0.2
      ELSE 1.0
    END
    """

    # Drop old column and rename
    alter table(:responsibilities) do
      remove :health
    end

    rename table(:responsibilities), :health_float, to: :health
  end

  def down do
    alter table(:responsibilities) do
      add :health_string, :string, default: "healthy"
    end

    flush()

    execute """
    UPDATE responsibilities SET health_string = CASE
      WHEN health >= 0.7 THEN 'healthy'
      WHEN health >= 0.4 THEN 'at_risk'
      ELSE 'failing'
    END
    """

    alter table(:responsibilities) do
      remove :health
    end

    rename table(:responsibilities), :health_string, to: :health
  end
end
