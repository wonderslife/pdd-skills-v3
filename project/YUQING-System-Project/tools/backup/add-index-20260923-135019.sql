ALTER TABLE yq_ledger_export_log ADD INDEX idx_yq_lexp_owner (create_by,create_time);
ALTER TABLE yq_ledger_export_log ADD INDEX idx_yq_lexp_status (status);
ALTER TABLE yq_push_record ADD INDEX idx_yq_pushrec_status (send_status,create_time);
ALTER TABLE yq_wecom_command ADD INDEX idx_yq_cmd_status (exec_status,create_time);
