import math

from app.services.nasa_service import NasaPowerService


def test_sentinel_and_annual_key_are_handled():
    payload = {
        "header": {"fill_value": -999.0},
        "properties": {
            "parameter": {
                "T2M": {"202001": 5.5, "202002": -999.0, "202003": 7.1, "202013": 6.0}
            }
        },
    }
    df = NasaPowerService.parse_payload(payload, "T2M")
    assert len(df) == 3  # the YYYY13 annual mean is skipped
    assert math.isnan(df.loc[1, "value"])  # -999 became NaN, not 0
    assert df.loc[0, "value"] == 5.5
