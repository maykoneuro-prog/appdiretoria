export interface TotvsStudentRow {
  _id?: string; // internal unique tracking id for UI manipulation
  _modified?: boolean;
  _modifiedFields?: string[];
  "UNIDADE": string | null;
  "HABILITACAO GRADE": string | null;
  "PERIODO": string | null;
  "TURMA": string | null;
  "EMAIL RESPACAD": string | null;
  "TURNO": number | string | null;
  "NOMETURNO": string | null;
  "PPESSOACODIGOALUNO": number | string | null;
  "RESPFINANCEIRO": string | null;
  "RESPACADEMICO": number | string | null;
  "RA": string | null;
  "STATUS": number | string | null;
  "COD ALUNO SCAE": string | null;
  "ALUNO": string | null;
  "SEXO": string | null;
  "COD MATRICULA SCAE": string | null;
  "FORMAINGRESSO": string | null;
  "DT NASCIMENTO": string | null;
  "NATURALIDADE": string | null;
  "EMAIL": string | null;
  "EMAIL EDUCACIONAL": string | null;
  "RUA": string | null;
  "NUMERO": string | null;
  "BAIRRO": string | null;
  "CIDADE": string | null;
  "UF": string | null;
  "CEP": string | null;
  "TELEFONE1": string | null;
  "TELEFONE2": string | null;
  "TELEFONE3": string | null;
  "CPF": string | null;
  "RG": string | null;
  "ORGAO RG": string | null;
  "ESTADO RG": string | null;
  "MAE": string | null;
  "PAI": string | null;
  "COD ALUNO SCAE1": string | null;
  "TIPO DOCUMENTO": string | null;
  "CNPJ EMPRESA": string | null;
  "EBEP": string | null;
  "NOME EMPRESA": string | null;
  "COD FINANCIAMENTO": string | null;
  "CURSO EBEP": string | null;
  "FORMA INGRESSO": string | null;
  "NOME CURSO": string | null;
  "COD CURSO": string | null;
  "COD CENTRO DE CUSTO": string | null;
  "NOME CENTRO DE CUSTO": string | null;
  "DT MATRICULA": string | null;
  "DT ALTERACAO": string | null;
  "DT MOBILIDADE": string | null;
  "TIPO MATRICULA": string | null;
  "CATEGORIA": string | null;
  "MES MATRICULA": string | null;
  "SITUACAO MATRICULA": string | null;
  "CODPLANOPGTO": string | null;
  "NOME": string | null;
  "MAX ALUNOS"?: number | string | null;
  [key: string]: string | number | boolean | string[] | null | undefined;
}

export interface TotvsQueryResult {
  Row: TotvsStudentRow[];
}

export interface TotvsQueryParams {
  baseUrl: string;
  codcoligada: string;
  codsentenca: string;
  codsistema: string;
  parameters: string;
}

export type FieldGroup =
  | 'academico'
  | 'aluno'
  | 'contato'
  | 'responsaveis'
  | 'financeiro';

export interface FieldDefinition {
  key: keyof Omit<TotvsStudentRow, '_id' | '_modified' | '_modifiedFields'>;
  label: string;
  group: FieldGroup;
  isNumeric?: boolean;
  isMono?: boolean;
  defaultVisible?: boolean;
  width?: string;
}

export const FIELD_GROUPS: Record<FieldGroup, string> = {
  academico: 'Acadêmico e Matrícula',
  aluno: 'Identificação do Aluno',
  contato: 'Endereço e Contato',
  responsaveis: 'Filiação e Responsáveis',
  financeiro: 'Indústria, EBEP e Plano Financeiro',
};

export const TOTVS_FIELDS: FieldDefinition[] = [
  // Acadêmico e Matrícula
  { key: 'PERIODO', label: 'Período Letivo', group: 'academico', isMono: true, defaultVisible: true, width: 'w-24' },
  { key: 'UNIDADE', label: 'Unidade SESI', group: 'academico', defaultVisible: true, width: 'w-44' },
  { key: 'RA', label: 'RA (Matrícula)', group: 'aluno', isMono: true, defaultVisible: true, width: 'w-28' },
  { key: 'ALUNO', label: 'Nome do Aluno', group: 'aluno', defaultVisible: true, width: 'w-64' },
  { key: 'CPF', label: 'CPF Aluno', group: 'aluno', isMono: true, defaultVisible: true, width: 'w-36' },
  { key: 'TURMA', label: 'Turma', group: 'academico', isMono: true, defaultVisible: true, width: 'w-28' },
  { key: 'MAX ALUNOS', label: 'Máx. Alunos (Turma)', group: 'academico', isNumeric: true, isMono: true, defaultVisible: true, width: 'w-32' },
  { key: 'NOME CURSO', label: 'Curso', group: 'academico', defaultVisible: true, width: 'w-40' },
  { key: 'NOMETURNO', label: 'Turno', group: 'academico', defaultVisible: true, width: 'w-28' },
  { key: 'TIPO MATRICULA', label: 'Tipo Matrícula', group: 'academico', defaultVisible: true, width: 'w-32' },
  { key: 'SITUACAO MATRICULA', label: 'Situação Matrícula', group: 'academico', defaultVisible: true, width: 'w-40' },
  { key: 'CATEGORIA', label: 'Categoria', group: 'financeiro', defaultVisible: true, width: 'w-48' },
  { key: 'NOME EMPRESA', label: 'Empresa Vinculada', group: 'financeiro', defaultVisible: true, width: 'w-52' },
  { key: 'CODPLANOPGTO', label: 'Cód. Plano Pgto', group: 'financeiro', isMono: true, defaultVisible: true, width: 'w-36' },
  { key: 'DT MATRICULA', label: 'Data Matrícula', group: 'academico', isMono: true, defaultVisible: true, width: 'w-32' },

  // Demais campos Acadêmicos
  { key: 'HABILITACAO GRADE', label: 'Habilitação / Grade', group: 'academico', width: 'w-64' },
  { key: 'COD CURSO', label: 'Cód. Curso', group: 'academico', isMono: true, width: 'w-24' },
  { key: 'TURNO', label: 'Cód. Turno', group: 'academico', isNumeric: true, isMono: true, width: 'w-24' },
  { key: 'STATUS', label: 'Status (Cód)', group: 'academico', isNumeric: true, isMono: true, width: 'w-24' },
  { key: 'MES MATRICULA', label: 'Mês Matrícula', group: 'academico', width: 'w-32' },
  { key: 'DT ALTERACAO', label: 'Data Alteração', group: 'academico', isMono: true, width: 'w-32' },
  { key: 'DT MOBILIDADE', label: 'Data Mobilidade', group: 'academico', isMono: true, width: 'w-32' },
  { key: 'FORMAINGRESSO', label: 'Forma Ingresso (1)', group: 'academico', width: 'w-36' },
  { key: 'FORMA INGRESSO', label: 'Forma Ingresso (2)', group: 'academico', width: 'w-36' },

  // Demais campos Identificação do Aluno
  { key: 'SEXO', label: 'Sexo', group: 'aluno', isMono: true, width: 'w-20' },
  { key: 'DT NASCIMENTO', label: 'Data Nascimento', group: 'aluno', isMono: true, width: 'w-40' },
  { key: 'NATURALIDADE', label: 'Naturalidade (UF)', group: 'aluno', isMono: true, width: 'w-24' },
  { key: 'RG', label: 'RG', group: 'aluno', isMono: true, width: 'w-32' },
  { key: 'ORGAO RG', label: 'Órgão RG', group: 'aluno', width: 'w-24' },
  { key: 'ESTADO RG', label: 'UF RG', group: 'aluno', isMono: true, width: 'w-20' },
  { key: 'PPESSOACODIGOALUNO', label: 'Cód. Pessoa Aluno', group: 'aluno', isNumeric: true, isMono: true, width: 'w-32' },
  { key: 'COD ALUNO SCAE', label: 'Cód. Aluno SCAE', group: 'aluno', isMono: true, width: 'w-32' },
  { key: 'COD ALUNO SCAE1', label: 'Cód. Aluno SCAE (Espelho)', group: 'aluno', isMono: true, width: 'w-32' },
  { key: 'COD MATRICULA SCAE', label: 'Cód. Matrícula SCAE', group: 'aluno', isMono: true, width: 'w-36' },

  // Endereço e Contato
  { key: 'TELEFONE2', label: 'Celular / Telefone 2', group: 'contato', isMono: true, width: 'w-36' },
  { key: 'TELEFONE1', label: 'Telefone 1', group: 'contato', isMono: true, width: 'w-36' },
  { key: 'TELEFONE3', label: 'Telefone 3', group: 'contato', isMono: true, width: 'w-36' },
  { key: 'EMAIL', label: 'E-mail Pessoal', group: 'contato', width: 'w-56' },
  { key: 'EMAIL EDUCACIONAL', label: 'E-mail Educacional', group: 'contato', width: 'w-56' },
  { key: 'RUA', label: 'Logradouro / Rua', group: 'contato', width: 'w-52' },
  { key: 'NUMERO', label: 'Número', group: 'contato', isMono: true, width: 'w-24' },
  { key: 'BAIRRO', label: 'Bairro', group: 'contato', width: 'w-40' },
  { key: 'CIDADE', label: 'Cidade', group: 'contato', width: 'w-36' },
  { key: 'UF', label: 'UF', group: 'contato', isMono: true, width: 'w-20' },
  { key: 'CEP', label: 'CEP', group: 'contato', isMono: true, width: 'w-28' },

  // Filiação e Responsáveis
  { key: 'MAE', label: 'Nome da Mãe', group: 'responsaveis', width: 'w-56' },
  { key: 'PAI', label: 'Nome do Pai', group: 'responsaveis', width: 'w-56' },
  { key: 'RESPACADEMICO', label: 'Cód. Resp. Acadêmico', group: 'responsaveis', isNumeric: true, isMono: true, width: 'w-36' },
  { key: 'EMAIL RESPACAD', label: 'E-mail Resp. Acadêmico', group: 'responsaveis', width: 'w-56' },
  { key: 'RESPFINANCEIRO', label: 'Cód. Resp. Financeiro', group: 'responsaveis', isMono: true, width: 'w-36' },

  // Indústria, EBEP e Plano Financeiro
  { key: 'NOME', label: 'Descrição Plano de Pagamento', group: 'financeiro', width: 'w-72' },
  { key: 'TIPO DOCUMENTO', label: 'Tipo Doc. Empresa', group: 'financeiro', isMono: true, width: 'w-28' },
  { key: 'CNPJ EMPRESA', label: 'CNPJ Empresa', group: 'financeiro', isMono: true, width: 'w-40' },
  { key: 'EBEP', label: 'Indicador EBEP', group: 'financeiro', isMono: true, width: 'w-24' },
  { key: 'CURSO EBEP', label: 'Curso EBEP', group: 'financeiro', width: 'w-40' },
  { key: 'COD FINANCIAMENTO', label: 'Cód. Financiamento', group: 'financeiro', isMono: true, width: 'w-32' },
  { key: 'COD CENTRO DE CUSTO', label: 'Cód. Centro de Custo', group: 'financeiro', isMono: true, width: 'w-40' },
  { key: 'NOME CENTRO DE CUSTO', label: 'Nome Centro de Custo', group: 'financeiro', width: 'w-52' },
];
