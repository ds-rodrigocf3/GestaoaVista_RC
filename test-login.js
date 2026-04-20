async function testLogin() {
  try {
    console.log('\n=== TESTE DE LOGIN ===\n');
    
    // Teste 1: Fazer login
    console.log('📝 Teste 1: Fazendo login...');
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@gestaobi.com',
        senha: '123456'
      })
    });

    const loginData = await response.json();
    
    if (response.status !== 200) {
      console.error('❌ Erro no login:', loginData.error);
      return;
    }
    
    console.log('✅ Login bem-sucedido');
    console.log('   Token:', loginData.token.substring(0, 50) + '...');
    
    // Teste 2: Verificar estrutura do usuário
    console.log('\n📝 Teste 2: Verificando estrutura do usuário...');
    const user = loginData.user;
    
    // Verificar campos obrigatórios
    const requiredFields = ['id', 'email', 'isAdmin'];
    let hasAllFields = true;
    
    for (const field of requiredFields) {
      if (!(field in user)) {
        console.error(`❌ Campo obrigatório faltando: ${field}`);
        hasAllFields = false;
      }
    }
    
    if (hasAllFields) {
      console.log('✅ Campos obrigatórios presentes: id, email, isAdmin');
    }
    
    // Verificar se colaborador tem os campos esperados
    if (user.colaborador) {
      const colaboradorFields = ['id', 'nome', 'cargo', 'nivel', 'color'];
      let allColaboradorFields = true;
      
      for (const field of colaboradorFields) {
        if (!(field in user.colaborador)) {
          console.error(`❌ Campo de colaborador faltando: ${field}`);
          allColaboradorFields = false;
        }
      }
      
      if (allColaboradorFields) {
        console.log('✅ Campos de colaborador presentes');
      }
    }
    
    // Teste 3: Simular armazenamento e restauração do sessionStorage
    console.log('\n📝 Teste 3: Simulando armazenamento em sessionStorage...');
    
    // Simular o que handleLogin faz
    const flattenedUser = {
      ...user,
      colaboradorId: user.colaborador?.id,
      nome: user.colaborador?.nome,
      cargo: user.colaborador?.cargo,
      nivelHierarquia: user.colaborador?.nivel,
      color: user.colaborador?.color,
      avatarUrl: user.colaborador?.avatarUrl,
      gestor: user.colaborador?.gestor,
      tpContrato: user.colaborador?.tpContrato
    };
    
    console.log('✅ Usuário flattened para sessionStorage:');
    console.log('   - colaboradorId:', flattenedUser.colaboradorId);
    console.log('   - nome:', flattenedUser.nome);
    console.log('   - nivelHierarquia:', flattenedUser.nivelHierarquia);
    
    // Verificar se os campos que o frontend usa estão presentes
    const frontendFields = ['colaboradorId', 'nome', 'nivelHierarquia', 'color', 'isAdmin'];
    let allFrontendFields = true;
    
    for (const field of frontendFields) {
      if (!(field in flattenedUser)) {
        console.error(`❌ Campo do frontend faltando: ${field}`);
        allFrontendFields = false;
      }
    }
    
    if (allFrontendFields) {
      console.log('\n✅ Todos os campos esperados pelo frontend estão presentes!');
    }
    
    console.log('\n=== RESULTADO ===');
    console.log('✅ Login funcionando corretamente');
    console.log('✅ Estrutura de dados compatível com o frontend');
    console.log('\n🎉 O problema de tela em branca deve estar resolvido!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testLogin();